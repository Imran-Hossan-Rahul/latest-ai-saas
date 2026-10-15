// PATCH /api/conversations/[id]/tag
// Sets or clears a tag on a conversation (hot_lead | closed | spam | null).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db/prisma";

const bodySchema = z.object({
  tag: z.enum(["hot_lead", "closed", "spam"]).nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as { id: string }).id;

  const conv = await prisma.conversation.findFirst({
    where: {
      id,
      facebookPage: { workspace: { members: { some: { userId } } } },
    },
  });

  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = bodySchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  }

  const updated = await prisma.conversation.update({
    where: { id },
    data: { tag: body.data.tag },
  });

  return NextResponse.json({ success: true, tag: updated.tag });
}
