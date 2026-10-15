// /api/pages/[pageId]
//
// DELETE — Disconnects a Facebook Page (unsubscribes webhook, marks inactive)
// PATCH  — Toggles the page's isActive status (pause/resume AI agent)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db/prisma";
import { decrypt } from "@/lib/encryption";
import { unsubscribePageFromWebhook, GraphApiError } from "@/lib/facebook/client";

// Helper: verify the requesting user owns the workspace this page belongs to
async function getAuthorizedPage(userId: string, pageId: string) {
  const page = await prisma.facebookPage.findUnique({
    where: { id: pageId },
    include: {
      workspace: {
        include: { members: { where: { userId } } },
      },
    },
  });

  if (!page || page.workspace.members.length === 0) return null;
  return page;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;
  const userId = (session.user as { id: string }).id;
  const page = await getAuthorizedPage(userId, pageId);

  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  // Attempt to unsubscribe from webhook — non-fatal if it fails
  // (token may be expired, or App Review may not be complete)
  try {
    const token = decrypt(page.encryptedAccessToken);
    await unsubscribePageFromWebhook(page.pageId, token);
  } catch (err) {
    console.warn(
      `[pages] Webhook unsubscribe failed for page ${page.pageId}:`,
      err instanceof GraphApiError ? err.message : err
    );
  }

  // Hard delete — cascades to conversations, messages, agentConfig
  await prisma.facebookPage.delete({ where: { id: pageId } });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;
  const userId = (session.user as { id: string }).id;
  const page = await getAuthorizedPage(userId, pageId);

  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  const body = await req.json();
  const updated = await prisma.facebookPage.update({
    where: { id: pageId },
    data: { isActive: body.isActive },
  });

  return NextResponse.json({ success: true, isActive: updated.isActive });
}
