// /api/agent-config/[pageId]
// GET — load the current AgentConfig for a page
// PUT — create or update the AgentConfig

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db/prisma";

const configSchema = z.object({
  businessName: z.string().min(1).max(100),
  businessType: z.string().min(1).max(100),
  productsInfo: z.string().min(1).max(5000),
  shippingInfo: z.string().max(1000).optional().nullable(),
  faqs: z.string().optional().nullable(),
  dosList: z.string().max(1000).optional().nullable(),
  dontsList: z.string().max(1000).optional().nullable(),
  agentName: z.string().min(1).max(50).default("Sales Assistant"),
  tone: z.enum(["friendly", "formal", "casual"]).default("friendly"),
  salesStyle: z.enum(["soft", "balanced", "assertive"]).default("soft"),
  language: z.enum(["auto", "en", "bn"]).default("auto"),
  escalateOnAnger: z.boolean().default(true),
  escalateKeywords: z.string().max(500).optional().nullable(),
});

async function getAuthorizedPage(userId: string, pageId: string) {
  return prisma.facebookPage.findFirst({
    where: {
      id: pageId,
      workspace: { members: { some: { userId } } },
    },
    include: { agentConfig: true },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;
  const userId = (session.user as { id: string }).id;
  const page = await getAuthorizedPage(userId, pageId);

  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true, config: page.agentConfig });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;
  const userId = (session.user as { id: string }).id;
  const page = await getAuthorizedPage(userId, pageId);

  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = configSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 400 }
    );
  }

  const config = await prisma.agentConfig.upsert({
    where: { facebookPageId: pageId },
    update: body.data,
    create: { facebookPageId: pageId, ...body.data },
  });

  return NextResponse.json({ success: true, config });
}
