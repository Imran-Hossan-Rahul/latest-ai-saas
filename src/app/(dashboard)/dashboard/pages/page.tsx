// /dashboard/pages — Server component.
// Fetches the user's connected Facebook Pages from the DB and renders the
// PagesList client component. All mutations (connect, disconnect, toggle)
// happen via API routes called from the client component.

import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db/prisma";
import { PagesList } from "@/components/dashboard/pages-list";

export const metadata: Metadata = { title: "Facebook Pages" };

async function getPages(userId: string) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    select: { workspaceId: true },
  });
  if (!membership) return [];

  return prisma.facebookPage.findMany({
    where: { workspaceId: membership.workspaceId },
    include: { _count: { select: { conversations: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export default async function PagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as { id: string }).id;

  const [pages, params] = await Promise.all([
    getPages(userId),
    searchParams,
  ]);

  // Surface OAuth result messages from the callback redirect
  const connected = params.connected ? Number(params.connected) : null;
  const oauthError = params.error ?? null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[rgb(var(--text-primary))]">
            Facebook Pages
          </h1>
          <p className="text-sm text-[rgb(var(--text-secondary))] mt-0.5">
            Connect your Facebook Pages to deploy the AI sales agent.
          </p>
        </div>
      </div>

      <PagesList
        initialPages={pages}
        connected={connected}
        oauthError={oauthError}
      />
    </div>
  );
}
