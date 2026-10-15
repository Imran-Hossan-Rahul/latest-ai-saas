// /dashboard/analytics — Server component.
// Computes all analytics metrics directly from the DB using efficient aggregations.
// No external analytics service needed — all data lives in our Postgres DB.

import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db/prisma";
import { GlassPanel } from "@/components/ui/glass-panel";
import { AnalyticsCharts } from "@/components/dashboard/analytics-charts";
import { Bot, Users, MessageSquare, TrendingUp, Clock, Tag } from "lucide-react";

export const metadata: Metadata = { title: "Analytics" };

async function getAnalyticsData(userId: string) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    select: { workspaceId: true },
  });
  if (!membership) return null;

  const pages = await prisma.facebookPage.findMany({
    where: { workspaceId: membership.workspaceId },
    select: { id: true, pageName: true },
  });

  if (pages.length === 0) return null;

  const pageIds = pages.map((p) => p.id);

  // Date range: last 30 days
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [
    totalConversations,
    aiConversations,
    humanConversations,
    closedConversations,
    hotLeads,
    totalMessages,
    assistantMessages,
    // Conversations created per day for the last 30 days
    conversationsByDay,
    // Message volume per day
    messagesByDay,
  ] = await Promise.all([
    prisma.conversation.count({ where: { facebookPageId: { in: pageIds } } }),
    prisma.conversation.count({ where: { facebookPageId: { in: pageIds }, status: "ai" } }),
    prisma.conversation.count({ where: { facebookPageId: { in: pageIds }, status: "human" } }),
    prisma.conversation.count({ where: { facebookPageId: { in: pageIds }, tag: "closed" } }),
    prisma.conversation.count({ where: { facebookPageId: { in: pageIds }, tag: "hot_lead" } }),
    prisma.message.count({
      where: { conversation: { facebookPageId: { in: pageIds } } },
    }),
    prisma.message.count({
      where: { conversation: { facebookPageId: { in: pageIds } }, role: "assistant" },
    }),
    // Group conversations by day using raw aggregation
    prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT DATE_TRUNC('day', "createdAt") as day, COUNT(*) as count
      FROM "Conversation"
      WHERE "facebookPageId" = ANY(${pageIds}::text[])
        AND "createdAt" >= ${since}
      GROUP BY day
      ORDER BY day ASC
    `,
    prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT DATE_TRUNC('day', m."createdAt") as day, COUNT(*) as count
      FROM "Message" m
      JOIN "Conversation" c ON c.id = m."conversationId"
      WHERE c."facebookPageId" = ANY(${pageIds}::text[])
        AND m."createdAt" >= ${since}
      GROUP BY day
      ORDER BY day ASC
    `,
  ]);

  // AI automation rate
  const automationRate =
    totalConversations > 0
      ? Math.round((aiConversations / totalConversations) * 100)
      : 0;

  // Average messages per conversation
  const avgMessagesPerConv =
    totalConversations > 0
      ? Math.round((totalMessages / totalConversations) * 10) / 10
      : 0;

  // Serialize BigInt from raw queries to number
  const convsByDay = conversationsByDay.map((r) => ({
    day: r.day.toISOString().split("T")[0],
    count: Number(r.count),
  }));

  const msgsByDay = messagesByDay.map((r) => ({
    day: r.day.toISOString().split("T")[0],
    count: Number(r.count),
  }));

  return {
    pages,
    stats: {
      totalConversations,
      aiConversations,
      humanConversations,
      closedConversations,
      hotLeads,
      totalMessages,
      assistantMessages,
      automationRate,
      avgMessagesPerConv,
    },
    charts: { convsByDay, msgsByDay },
  };
}

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as { id: string }).id;
  const data = await getAnalyticsData(userId);

  if (!data) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold text-[rgb(var(--text-primary))] mb-6">Analytics</h1>
        <GlassPanel radius="xl" className="p-12 flex flex-col items-center gap-3 text-center">
          <TrendingUp className="w-10 h-10 text-[rgb(var(--text-muted))]" />
          <p className="text-[rgb(var(--text-secondary))] text-sm">
            Connect a Facebook Page to start seeing analytics.
          </p>
        </GlassPanel>
      </div>
    );
  }

  const { stats, charts } = data;

  const statCards = [
    {
      label: "Total conversations",
      value: stats.totalConversations,
      icon: MessageSquare,
      color: "text-[rgb(var(--accent))]",
      bg: "bg-[rgb(var(--accent)/0.1)]",
    },
    {
      label: "AI automation rate",
      value: `${stats.automationRate}%`,
      icon: Bot,
      color: "text-[rgb(var(--success))]",
      bg: "bg-[rgb(var(--success)/0.1)]",
      hint: `${stats.aiConversations} of ${stats.totalConversations} handled by AI`,
    },
    {
      label: "Human takeovers",
      value: stats.humanConversations,
      icon: Users,
      color: "text-[rgb(var(--warning))]",
      bg: "bg-[rgb(var(--warning)/0.1)]",
    },
    {
      label: "Hot leads",
      value: stats.hotLeads,
      icon: Tag,
      color: "text-[rgb(var(--warning))]",
      bg: "bg-[rgb(var(--warning)/0.1)]",
    },
    {
      label: "Total messages",
      value: stats.totalMessages,
      icon: MessageSquare,
      color: "text-[rgb(var(--accent))]",
      bg: "bg-[rgb(var(--accent)/0.1)]",
    },
    {
      label: "Avg messages / conv",
      value: stats.avgMessagesPerConv,
      icon: Clock,
      color: "text-[rgb(var(--text-secondary))]",
      bg: "bg-[rgb(var(--text-muted)/0.1)]",
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[rgb(var(--text-primary))]">Analytics</h1>
        <p className="text-sm text-[rgb(var(--text-secondary))] mt-0.5">
          Last 30 days · All connected pages
        </p>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg, hint }) => (
          <GlassPanel key={label} radius="lg" className="p-5 space-y-3">
            <div className={`inline-flex p-2 rounded-[10px] ${bg}`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-semibold text-[rgb(var(--text-primary))]">{value}</p>
              <p className="text-xs text-[rgb(var(--text-muted))] mt-0.5">{label}</p>
              {hint && <p className="text-xs text-[rgb(var(--text-muted))] mt-0.5">{hint}</p>}
            </div>
          </GlassPanel>
        ))}
      </div>

      {/* AI vs Human donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassPanel radius="xl" className="p-5">
          <h2 className="font-semibold text-[rgb(var(--text-primary))] mb-4">
            AI vs Human split
          </h2>
          <AnalyticsCharts
            type="donut"
            data={[
              { label: "AI handled", value: stats.aiConversations, color: "rgb(var(--accent))" },
              { label: "Human takeover", value: stats.humanConversations, color: "rgb(var(--warning))" },
              { label: "Closed", value: stats.closedConversations, color: "rgb(var(--text-muted))" },
            ]}
          />
        </GlassPanel>

        <GlassPanel radius="xl" className="p-5">
          <h2 className="font-semibold text-[rgb(var(--text-primary))] mb-4">
            Conversation tags
          </h2>
          <AnalyticsCharts
            type="bar"
            data={[
              { label: "Hot leads", value: stats.hotLeads, color: "rgb(var(--warning))" },
              { label: "Closed", value: stats.closedConversations, color: "rgb(var(--success))" },
              { label: "Human", value: stats.humanConversations, color: "rgb(var(--accent))" },
            ]}
          />
        </GlassPanel>
      </div>

      {/* Daily volume chart */}
      <GlassPanel radius="xl" className="p-5">
        <h2 className="font-semibold text-[rgb(var(--text-primary))] mb-4">
          Daily conversation volume — last 30 days
        </h2>
        <AnalyticsCharts
          type="line"
          data={charts.convsByDay.map((d) => ({
            label: d.day,
            value: d.count,
            color: "rgb(var(--accent))",
          }))}
        />
      </GlassPanel>
    </div>
  );
}
