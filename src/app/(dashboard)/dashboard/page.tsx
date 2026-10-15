// Dashboard overview — server component that fetches real stats from the DB.
// Shows key metrics, recent conversations, and connected pages at a glance.

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db/prisma";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Bot, Users, Zap, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

async function getDashboardData(userId: string) {
  // Get the user's first workspace (multi-workspace selector comes in a later stage)
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    include: {
      workspace: {
        include: {
          facebookPages: {
            include: { _count: { select: { conversations: true } } },
          },
        },
      },
    },
  });

  if (!membership) return null;

  const { workspace } = membership;
  const pageIds = workspace.facebookPages.map((p) => p.id);

  const [totalConversations, aiHandled, humanHandled, recentConversations] =
    await Promise.all([
      prisma.conversation.count({ where: { facebookPageId: { in: pageIds } } }),
      prisma.conversation.count({
        where: { facebookPageId: { in: pageIds }, status: "ai" },
      }),
      prisma.conversation.count({
        where: { facebookPageId: { in: pageIds }, status: "human" },
      }),
      prisma.conversation.findMany({
        where: { facebookPageId: { in: pageIds } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
          facebookPage: { select: { pageName: true } },
        },
      }),
    ]);

  return {
    workspace,
    stats: { totalConversations, aiHandled, humanHandled },
    recentConversations,
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  // Layout already guards auth, but we need the user id here
  const userId = (session!.user as { id: string }).id;
  const data = await getDashboardData(userId);

  if (!data) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <GlassPanel radius="xl" className="p-8 text-center max-w-md space-y-4">
          <Bot className="w-12 h-12 text-[rgb(var(--accent))] mx-auto" />
          <h2 className="text-xl font-semibold text-[rgb(var(--text-primary))]">
            Welcome to SalesBot AI
          </h2>
          <p className="text-sm text-[rgb(var(--text-secondary))]">
            Connect your first Facebook Page to get started. Your AI sales agent
            will be live in minutes.
          </p>
          <Button asChild size="lg" className="w-full">
            <Link href="/dashboard/pages">
              <Plus className="w-4 h-4" />
              Connect a Facebook Page
            </Link>
          </Button>
        </GlassPanel>
      </div>
    );
  }

  const { workspace, stats, recentConversations } = data;

  const statCards = [
    {
      label: "Total Conversations",
      value: stats.totalConversations,
      icon: MessageSquare,
      color: "text-[rgb(var(--accent))]",
      bg: "bg-[rgb(var(--accent)/0.1)]",
    },
    {
      label: "AI Handled",
      value: stats.aiHandled,
      icon: Bot,
      color: "text-[rgb(var(--success))]",
      bg: "bg-[rgb(var(--success)/0.1)]",
    },
    {
      label: "Human Takeovers",
      value: stats.humanHandled,
      icon: Users,
      color: "text-[rgb(var(--warning))]",
      bg: "bg-[rgb(var(--warning)/0.1)]",
    },
    {
      label: "Connected Pages",
      value: workspace.facebookPages.length,
      icon: Zap,
      color: "text-[rgb(var(--text-secondary))]",
      bg: "bg-[rgb(var(--text-muted)/0.1)]",
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[rgb(var(--text-primary))]">
            {workspace.name}
          </h1>
          <p className="text-sm text-[rgb(var(--text-secondary))] mt-0.5">
            Here&apos;s what&apos;s happening with your AI agent today.
          </p>
        </div>
        <Button asChild size="md">
          <Link href="/dashboard/pages">
            <Plus className="w-4 h-4" />
            Add Page
          </Link>
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <GlassPanel key={label} radius="lg" className="p-5 space-y-3">
            <div className={`inline-flex p-2 rounded-[10px] ${bg}`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-semibold text-[rgb(var(--text-primary))]">
                {value}
              </p>
              <p className="text-xs text-[rgb(var(--text-muted))] mt-0.5">{label}</p>
            </div>
          </GlassPanel>
        ))}
      </div>

      {/* Recent conversations */}
      <GlassPanel radius="xl" className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgb(var(--glass-border))]">
          <h2 className="font-semibold text-[rgb(var(--text-primary))]">
            Recent Conversations
          </h2>
          <Button asChild variant="bare" size="sm">
            <Link href="/dashboard/inbox" className="flex items-center gap-1">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </div>

        {recentConversations.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[rgb(var(--text-muted))]">
            No conversations yet. Messages will appear here once customers reach out.
          </div>
        ) : (
          <ul className="divide-y divide-[rgb(var(--glass-border))]">
            {recentConversations.map((conv) => {
              const lastMsg = conv.messages[0];
              return (
                <li key={conv.id}>
                  <Link
                    href={`/dashboard/inbox?conversation=${conv.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/5 transition-colors"
                  >
                    {/* Avatar placeholder */}
                    <div className="w-9 h-9 rounded-full bg-[rgb(var(--accent)/0.15)] flex items-center justify-center shrink-0">
                      <span className="text-sm font-medium text-[rgb(var(--accent))]">
                        {(conv.customerName ?? "?")[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[rgb(var(--text-primary))] truncate">
                          {conv.customerName ?? "Unknown Customer"}
                        </span>
                        <Badge
                          variant={conv.status as "ai" | "human" | "closed"}
                        >
                          {conv.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-[rgb(var(--text-muted))] truncate mt-0.5">
                        {lastMsg?.content ?? "No messages yet"}
                      </p>
                    </div>
                    <span className="text-xs text-[rgb(var(--text-muted))] shrink-0">
                      {conv.facebookPage.pageName}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </GlassPanel>

      {/* Connected pages */}
      {workspace.facebookPages.length > 0 && (
        <GlassPanel radius="xl" className="overflow-hidden">
          <div className="px-5 py-4 border-b border-[rgb(var(--glass-border))]">
            <h2 className="font-semibold text-[rgb(var(--text-primary))]">
              Connected Pages
            </h2>
          </div>
          <ul className="divide-y divide-[rgb(var(--glass-border))]">
            {workspace.facebookPages.map((page) => (
              <li
                key={page.id}
                className="flex items-center gap-4 px-5 py-3.5"
              >
                {page.pictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={page.pictureUrl}
                    alt={page.pageName}
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[rgb(var(--accent)/0.15)] flex items-center justify-center">
                    <span className="text-sm font-medium text-[rgb(var(--accent))]">
                      {page.pageName[0]}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[rgb(var(--text-primary))] truncate">
                    {page.pageName}
                  </p>
                  <p className="text-xs text-[rgb(var(--text-muted))]">
                    {page._count.conversations} conversations
                  </p>
                </div>
                <Badge variant={page.isActive ? "ai" : "closed"}>
                  {page.isActive ? "Active" : "Inactive"}
                </Badge>
              </li>
            ))}
          </ul>
        </GlassPanel>
      )}
    </div>
  );
}
