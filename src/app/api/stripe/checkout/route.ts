// POST /api/stripe/checkout
// Creates a Stripe Checkout session and returns the URL to redirect the user to.
// On success, Stripe redirects to /dashboard/billing?success=true.
// On cancel, Stripe redirects to /dashboard/billing?canceled=true.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/client";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
  });

  if (!membership) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const { workspace } = membership;

  // Reuse existing Stripe customer if one exists, otherwise create a new one.
  // This ensures the customer's billing history is preserved across sessions.
  let customerId = workspace.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user?.email ?? undefined,
      name: session.user?.name ?? undefined,
      metadata: { workspaceId: workspace.id },
    });
    customerId = customer.id;

    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID!,
        quantity: 1,
      },
    ],
    // Pass workspaceId in metadata so the webhook can update the right record
    subscription_data: {
      metadata: { workspaceId: workspace.id },
      trial_period_days: 7,
    },
    success_url: `${process.env.NEXTAUTH_URL}/dashboard/billing?success=true`,
    cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/billing?canceled=true`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
