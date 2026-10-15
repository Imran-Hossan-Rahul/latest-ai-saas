// POST /api/webhooks/stripe
// Handles Stripe webhook events to keep subscription state in sync with the DB.
//
// We verify the Stripe-Signature header on every request — this is the only
// way to confirm the event genuinely came from Stripe, not a spoofed POST.
//
// Events handled:
//   checkout.session.completed     — new subscription created
//   customer.subscription.updated  — plan change, renewal, trial end
//   customer.subscription.deleted  — cancellation
//   invoice.payment_failed         — payment failure → past_due

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { prisma } from "@/lib/db/prisma";

// Stripe requires the raw body bytes for signature verification —
// we must NOT parse JSON before verifying.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new NextResponse("Missing Stripe-Signature header", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      // ── New subscription created via Checkout ───────────────────────────
      case "checkout.session.completed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        if (checkoutSession.mode !== "subscription") break;

        const subscriptionId = checkoutSession.subscription as string;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const workspaceId = subscription.metadata.workspaceId;

        if (!workspaceId) {
          console.error("[stripe-webhook] No workspaceId in subscription metadata");
          break;
        }

        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            stripeSubscriptionId: subscription.id,
            stripePriceId: subscription.items.data[0]?.price.id ?? null,
            subscriptionStatus: subscription.status,
          },
        });
        break;
      }

      // ── Subscription updated (renewal, plan change, trial end) ──────────
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const workspaceId = subscription.metadata.workspaceId;
        if (!workspaceId) break;

        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            stripePriceId: subscription.items.data[0]?.price.id ?? null,
            subscriptionStatus: subscription.status,
          },
        });
        break;
      }

      // ── Subscription canceled ────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const workspaceId = subscription.metadata.workspaceId;
        if (!workspaceId) break;

        await prisma.workspace.update({
          where: { id: workspaceId },
          data: { subscriptionStatus: "canceled" },
        });
        break;
      }

      // ── Payment failed ───────────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        // parent.subscription_id is the stable field in newer Stripe API versions
        const subscriptionId =
          (invoice as unknown as Record<string, unknown>).subscription as string | undefined
          ?? (invoice.parent as unknown as Record<string, unknown> | null)?.subscription_details as string | undefined;

        if (!subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const workspaceId = subscription.metadata.workspaceId;
        if (!workspaceId) break;

        await prisma.workspace.update({
          where: { id: workspaceId },
          data: { subscriptionStatus: "past_due" },
        });
        break;
      }

      default:
        // Unhandled event types — log and ignore
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`[stripe-webhook] Error processing ${event.type}:`, err);
    // Return 500 so Stripe retries the event
    return new NextResponse("Webhook processing error", { status: 500 });
  }

  return new NextResponse("OK", { status: 200 });
}
