// /api/webhooks/facebook
//
// GET  — Facebook's webhook verification challenge (called once when you set up the webhook)
// POST — Incoming Messenger events (messages, postbacks)
//
// Critical constraints:
//   - Must respond within 5 seconds or Facebook retries (and eventually disables the webhook)
//   - Must verify X-Hub-Signature-256 on every POST
//   - Must return 200 even if we can't process the event (to prevent Facebook retries)
//     — we log errors internally instead of returning 5xx

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { inngest } from "@/lib/inngest/client";
import { verifyWebhookSignature } from "@/lib/facebook/webhook";
import type { FacebookWebhookPayload } from "@/types";

// ─── GET: Webhook verification ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN
  ) {
    console.log("[webhook] Facebook webhook verified successfully");
    // Return the challenge as plain text — Facebook expects exactly this
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[webhook] Webhook verification failed — token mismatch");
  return new NextResponse("Forbidden", { status: 403 });
}

// ─── POST: Incoming events ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Read raw body as Buffer for signature verification.
  // We MUST read the raw bytes before any JSON parsing — once parsed, the
  // original byte sequence may differ and the HMAC won't match.
  const rawBody = Buffer.from(await req.arrayBuffer());
  const signature = req.headers.get("x-hub-signature-256") ?? "";

  // Reject requests that don't have a valid Facebook signature
  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error("[webhook] Invalid signature — request rejected");
    // Return 200 anyway to prevent Facebook from disabling the webhook,
    // but log the rejection for investigation
    return new NextResponse("OK", { status: 200 });
  }

  let payload: FacebookWebhookPayload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    console.error("[webhook] Failed to parse webhook payload");
    return new NextResponse("OK", { status: 200 });
  }

  // We only handle page-level events (Messenger)
  if (payload.object !== "page") {
    return new NextResponse("OK", { status: 200 });
  }

  // Process each entry asynchronously — respond to Facebook immediately,
  // then let Inngest handle the heavy lifting in the background
  const processingPromises = payload.entry.flatMap((entry) =>
    (entry.messaging ?? []).map(async (event) => {
      const facebookPageId = entry.id;
      const senderPsid = event.sender.id;
      const messageText = event.message?.text ?? null;
      const facebookMid = event.message?.mid ?? `postback-${event.timestamp}`;

      // Log the event metadata (no message content — privacy compliance)
      try {
        await prisma.webhookEvent.create({
          data: {
            pageId: facebookPageId,
            eventType: event.message ? "messages" : "messaging_postbacks",
            senderPsid,
            processed: false,
          },
        });
      } catch (logErr) {
        // Non-fatal — don't let logging failure block event processing
        console.error("[webhook] Failed to log event:", logErr);
      }

      // Look up our internal page record by Facebook's page ID
      const page = await prisma.facebookPage.findFirst({
        where: { pageId: facebookPageId, isActive: true },
        select: { id: true },
      });

      if (!page) {
        console.warn(`[webhook] Received event for unknown/inactive page: ${facebookPageId}`);
        return;
      }

      // Ignore messages sent by the page itself (echoes from our own replies)
      if (senderPsid === facebookPageId) return;

      // Queue the Inngest job — this returns immediately, processing happens async
      await inngest.send({
        name: "messenger/message.received",
        data: {
          pageId: page.id,
          facebookPageId,
          senderPsid,
          messageText,
          facebookMid,
          timestamp: event.timestamp,
        },
      });
    })
  );

  // Fire-and-forget — we don't await these so Facebook gets its <5s response
  Promise.allSettled(processingPromises).catch((err) =>
    console.error("[webhook] Processing error:", err)
  );

  return new NextResponse("OK", { status: 200 });
}
