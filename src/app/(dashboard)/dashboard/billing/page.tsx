// /dashboard/billing — Server component.
// Shows the current subscription status and lets the user subscribe or manage
// their plan via Stripe Checkout / Customer Portal.

import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db/prisma";
import { BillingView } from "@/components/dashboard/billing-view";

export const metadata: Metadata = { title: "Billing" };

async function getBillingData(userId: string) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          subscriptionStatus: true,
          stripeSubscriptionId: true,
          stripeCustomerId: true,
        },
      },
    },
  });
  return membership?.workspace ?? null;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as { id: string }).id;

  const [workspace, params] = await Promise.all([
    getBillingData(userId),
    searchParams,
  ]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[rgb(var(--text-primary))]">Billing</h1>
        <p className="text-sm text-[rgb(var(--text-secondary))] mt-0.5">
          Manage your SalesBot AI subscription.
        </p>
      </div>
      <BillingView
        workspace={workspace}
        checkoutSuccess={params.success === "true"}
        checkoutCanceled={params.canceled === "true"}
      />
    </div>
  );
}
