// /dashboard/settings — Server component.
// Loads all connected pages and their AgentConfig records.
// The AgentConfigForm client component handles the actual editing.

import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db/prisma";
import { AgentConfigForm } from "@/components/dashboard/agent-config-form";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Settings, Globe } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Settings" };

async function getPagesWithConfig(userId: string) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    select: { workspaceId: true },
  });
  if (!membership) return [];

  return prisma.facebookPage.findMany({
    where: { workspaceId: membership.workspaceId },
    include: { agentConfig: true },
    orderBy: { createdAt: "asc" },
  });
}

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as { id: string }).id;
  const pages = await getPagesWithConfig(userId);

  if (pages.length === 0) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-[rgb(var(--text-primary))] mb-6">Settings</h1>
        <GlassPanel radius="xl" className="p-12 flex flex-col items-center gap-4 text-center">
          <Settings className="w-10 h-10 text-[rgb(var(--text-muted))]" />
          <div className="space-y-1">
            <p className="font-medium text-[rgb(var(--text-primary))]">No pages connected</p>
            <p className="text-sm text-[rgb(var(--text-secondary))]">
              Connect a Facebook Page first to configure the AI agent.
            </p>
          </div>
          <Button asChild size="md">
            <Link href="/dashboard/pages">
              <Globe className="w-4 h-4" />
              Connect a Page
            </Link>
          </Button>
        </GlassPanel>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[rgb(var(--text-primary))]">Settings</h1>
        <p className="text-sm text-[rgb(var(--text-secondary))] mt-0.5">
          Configure the AI agent&apos;s persona, products, and behaviour for each page.
        </p>
      </div>
      <AgentConfigForm pages={pages} />
    </div>
  );
}
