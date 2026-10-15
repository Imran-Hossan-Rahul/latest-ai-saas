// /dashboard/inbox — Server component.
// Fetches all conversations for the user's workspace, sorted by most recent.
// The selected conversation ID comes from the ?conversation= query param,
// allowing deep-linking directly into a thread.

import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db/prisma";
import { InboxView } from "@/components/dashboard/inbox-view";

export const metadata: Metadata = { title: "Inbox" };

async function getInboxData(userId: string) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    select: { workspaceId: true },
  });
  if (!membership) return { conversations: [], pages: [] };

  const pages = await prisma.facebookPage.findMany({
    where: { workspaceId: membership.workspaceId },
    select: { id: true, pageName: true, pageId: true },
  });

  const pageIds = pages.map((p) => p.id);

  const conversations = await prisma.conversation.findMany({
    where: { facebookPageId: { in: pageIds } },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      facebookPage: { select: { pageName: true, pageId: true } },
    },
  });

  return { conversations, pages };
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as { id: string }).id;

  const [{ conversations, pages }, params] = await Promise.all([
    getInboxData(userId),
    searchParams,
  ]);

  const selectedId = params.conversation ?? null;

  return (
    <InboxView
      initialConversations={conversations}
      pages={pages}
      initialSelectedId={selectedId}
    />
  );
}
