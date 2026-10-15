// POST /api/conversations/[id]/takeover
// Toggles a conversation between "ai" and "human" mode.
// When an owner takes over, the AI stops replying to that thread.
// When they hand back, the AI resumes.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db/prisma";

const bodySchema = z.object({
  status: z.enum(["ai", "human"]),
});

async function getAuthorizedConversation(userId: string, conversationId: string) {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      facebookPage: {
        workspace: { members: { some: { userId } } },
      },
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as { id: string }).id;

  const conv = await getAuthorizedConversation(userId, id);
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = bodySchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await prisma.conversation.update({
    where: { id },
    data: { status: body.data.status },
  });

  return NextResponse.json({ success: true, status: updated.status });
}
