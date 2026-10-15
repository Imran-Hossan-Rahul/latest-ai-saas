// GET /api/conversations/[id]/messages
// Returns the full message history for a conversation.
// Auth-guarded: only members of the conversation's workspace can access it.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as { id: string }).id;

  // Verify the requesting user belongs to the workspace that owns this conversation
  const conversation = await prisma.conversation.findFirst({
    where: {
      id,
      facebookPage: { workspace: { members: { some: { userId } } } },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ success: true, messages });
}
