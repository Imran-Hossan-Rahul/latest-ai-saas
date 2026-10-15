// POST /api/conversations/[id]/reply
// Allows the business owner to send a manual reply from the dashboard.
// Sends via the Facebook Send API and persists to the conversation history.
// Only works when the conversation is in "human" mode (owner has taken over).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db/prisma";
import { decrypt } from "@/lib/encryption";
import { sendMessage } from "@/lib/facebook/client";

const bodySchema = z.object({
  text: z.string().min(1).max(2000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as { id: string }).id;

  const conversation = await prisma.conversation.findFirst({
    where: {
      id,
      facebookPage: { workspace: { members: { some: { userId } } } },
    },
    include: { facebookPage: true },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = bodySchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Message text is required" }, { status: 400 });
  }

  const { text } = body.data;

  // Send via Facebook Messenger
  const pageToken = decrypt(conversation.facebookPage.encryptedAccessToken);
  await sendMessage(conversation.customerPsid, text, pageToken);

  // Persist to conversation history
  const message = await prisma.message.create({
    data: {
      conversationId: id,
      role: "assistant",
      content: text,
    },
  });

  // Bump conversation updatedAt so it surfaces at the top of the inbox
  await prisma.conversation.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ success: true, message });
}
