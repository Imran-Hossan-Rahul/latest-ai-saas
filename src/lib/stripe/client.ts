// Stripe client — lazily initialized so Next.js build-time static analysis
// doesn't fail when STRIPE_SECRET_KEY is absent from the build environment.
// The actual Stripe instance is created on first use at runtime.

import Stripe from "stripe";

let _stripe: Stripe | null = null;

/** Returns the Stripe singleton, initializing it on first call. */
export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { typescript: true });
  }
  return _stripe;
}

// Convenience re-export for callers that prefer `stripe.xxx` syntax.
// This is a Proxy so the instance is still created lazily.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// ─── Subscription status helpers ─────────────────────────────────────────────

export function isSubscriptionActive(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

export function subscriptionStatusLabel(status: string | null | undefined): string {
  const labels: Record<string, string> = {
    active: "Active",
    trialing: "Free trial",
    past_due: "Past due",
    canceled: "Canceled",
    unpaid: "Unpaid",
    incomplete: "Incomplete",
    incomplete_expired: "Expired",
    paused: "Paused",
  };
  return labels[status ?? ""] ?? "No subscription";
}
