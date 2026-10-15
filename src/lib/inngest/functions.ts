// Inngest background functions — Inngest v4 API.
//
// Why Inngest instead of processing inline in the webhook?
// Facebook requires a <5s response to webhook POSTs or it retries (and eventually
// disables your webhook). AI inference can take 3-10s. We respond to Facebook
// immediately, then process asynchronously here with automatic retries.

import { inngest, type MessengerMessageReceivedData } from "./client";
import { prisma } from "@/lib/db/prisma";
import { decrypt } from "@/lib/encryption";
import { getCustomerProfile, sendMessage } from "@/lib/facebook/client";
import { runAgent } from "@/lib/ai/agent";

export const processMessengerEvent = inngest.createFunction(
  {
    id: "process-messenger-event",
    triggers: [{ event: "messenger/message.received" }],
    retries: 3,
    // Serialize processing per page to avoid race conditions on conversation state
    concurrency: {
      limit: 5,
      key: "event.data.pageId",
    },
  },
  async ({ event, step }) => {
    const data = event.data as MessengerMessageReceivedData;
    const { pageId, senderPsid, messageText, facebookMid, timestamp } = data;

    // ── Step 1: Deduplicate by Facebook message ID ────────────────────────────
    // Inngest retries on failure — idempotency prevents double-replies.
    const alreadyProcessed = await step.run("check-duplicate", async () => {
      const existing = await prisma.message.findUnique({ where: { facebookMid } });
      return !!existing;
    });

    if (alreadyProcessed) return { skipped: true, reason: "duplicate" };

    // ── Step 2: Load page config + upsert conversation ────────────────────────
    const { page, conversation } = await step.run("load-or-create-conversation", async () => {
      const fbPage = await prisma.facebookPage.findUnique({
        where: { id: pageId },
        include: { agentConfig: true },
      });

      if (!fbPage || !fbPage.isActive) {
        throw new Error(`Page ${pageId} not found or inactive`);
      }

      const conv = await prisma.conversation.upsert({
        where: { facebookPageId_customerPsid: { facebookPageId: pageId, customerPsid: senderPsid } },
        update: { updatedAt: new Date(timestamp) },
        create: { facebookPageId: pageId, customerPsid: senderPsid, status: "ai" },
      });

      return { page: fbPage, conversation: conv };
    });

    // ── Step 3: Fetch customer profile on first contact ───────────────────────
    if (!conversation.customerName) {
      await step.run("fetch-customer-profile", async () => {
        try {
          const token = decrypt(page.encryptedAccessToken);
          const profile = await getCustomerProfile(senderPsid, token);
          if (profile.name) {
            await prisma.conversation.update({
              where: { id: conversation.id },
              data: { customerName: profile.name, customerPicUrl: profile.profile_pic ?? null },
            });
          }
        } catch (err) {
          console.warn("[inngest] Profile fetch failed (expected before App Review):", err);
        }
      });
    }

    // ── Step 4: Persist the inbound message ──────────────────────────────────
    await step.run("store-inbound-message", async () => {
      if (!messageText) return;
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "user",
          content: messageText,
          facebookMid,
          createdAt: new Date(timestamp),
        },
      });
    });

    // ── Step 5: Skip AI if conversation is in human mode ─────────────────────
    // Owner has taken over — don't let the AI reply over them.
    if (conversation.status === "human") {
      return { skipped: true, reason: "human_takeover" };
    }

    // Skip if no message text (attachments, stickers, etc.)
    if (!messageText) {
      return { skipped: true, reason: "no_text" };
    }

    // Skip if no agent config — page hasn't been configured yet
    if (!page.agentConfig) {
      console.warn(`[inngest] No AgentConfig for page ${pageId} — skipping AI reply`);
      return { skipped: true, reason: "no_agent_config" };
    }

    // ── Step 6: Run AI agent ──────────────────────────────────────────────────
    // This is the expensive step — Claude inference. If it fails, only this
    // step retries (steps 1-5 are already committed).
    // We re-fetch everything inside the step to avoid Inngest's JSON serialization
    // converting Date objects to strings across step boundaries.
    const agentResponse = await step.run("generate-ai-reply", async () => {
      const [freshConv, freshPage] = await Promise.all([
        prisma.conversation.findUnique({
          where: { id: conversation.id },
          select: { customerName: true, contextSummary: true },
        }),
        prisma.facebookPage.findUnique({
          where: { id: pageId },
          include: { agentConfig: true },
        }),
      ]);

      if (!freshPage?.agentConfig) throw new Error("AgentConfig missing");

      return runAgent({
        conversationId: conversation.id,
        inboundMessage: messageText,
        config: freshPage.agentConfig,
        customerName: freshConv?.customerName ?? null,
        existingSummary: freshConv?.contextSummary ?? null,
      });
    });

    // ── Step 7: Persist AI reply + send via Messenger ─────────────────────────
    await step.run("send-reply", async () => {
      const pageToken = decrypt(page.encryptedAccessToken);

      // If the agent signals a handoff, switch conversation to human mode
      // and notify the owner (notification system added in Stage 4)
      if (agentResponse.shouldHandOff) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { status: "human" },
        });
        console.log(
          `[inngest] Handoff triggered for conversation ${conversation.id}: ${agentResponse.handOffReason}`
        );
      }

      // Always send the reply message — even on handoff, Claude generates
      // a polite "connecting you to our team" message for the customer
      await sendMessage(senderPsid, agentResponse.reply, pageToken);

      // Persist the assistant's reply in the conversation history
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: agentResponse.reply,
        },
      });

      // Mark the webhook event as processed
      await prisma.webhookEvent.updateMany({
        where: { senderPsid, pageId: page.pageId, processed: false },
        data: { processed: true },
      });
    });

    return {
      success: true,
      conversationId: conversation.id,
      handedOff: agentResponse.shouldHandOff,
    };
  }
);
