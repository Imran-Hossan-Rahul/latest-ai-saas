// GET /api/facebook/callback
// Handles the OAuth callback from Facebook after the user grants permissions.
//
// Flow:
//   1. Validate CSRF state token
//   2. Exchange authorization code for user access token
//   3. Fetch all pages the user manages
//   4. For each page: encrypt token, upsert to DB, subscribe to webhook
//   5. Redirect to /dashboard/pages with success/error query param

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db/prisma";
import { encrypt } from "@/lib/encryption";
import {
  exchangeCode,
  getUserPages,
  subscribePageToWebhook,
  GraphApiError,
} from "@/lib/facebook/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // User denied permissions
  if (error) {
    console.warn("[fb-callback] User denied Facebook permissions:", error);
    return NextResponse.redirect(
      new URL("/dashboard/pages?error=permission_denied", req.url)
    );
  }

  // Validate CSRF state
  const storedState = req.cookies.get("fb_oauth_state")?.value;
  if (!state || !storedState || state !== storedState) {
    console.error("[fb-callback] CSRF state mismatch");
    return NextResponse.redirect(
      new URL("/dashboard/pages?error=invalid_state", req.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/dashboard/pages?error=no_code", req.url)
    );
  }

  try {
    // ── Exchange code for user access token ───────────────────────────────────
    const tokenData = await exchangeCode(code);

    // ── Fetch all pages this user manages ─────────────────────────────────────
    const pages = await getUserPages(tokenData.access_token);

    if (pages.length === 0) {
      return NextResponse.redirect(
        new URL("/dashboard/pages?error=no_pages", req.url)
      );
    }

    // ── Get the user's workspace ──────────────────────────────────────────────
    const userId = (session.user as { id: string }).id;
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });

    if (!membership) {
      return NextResponse.redirect(
        new URL("/dashboard/pages?error=no_workspace", req.url)
      );
    }

    // ── Upsert each page + subscribe to webhook ───────────────────────────────
    let connectedCount = 0;
    const errors: string[] = [];

    for (const page of pages) {
      try {
        // Encrypt the page-level access token before storing
        const encryptedToken = encrypt(page.access_token);

        await prisma.facebookPage.upsert({
          where: {
            workspaceId_pageId: {
              workspaceId: membership.workspaceId,
              pageId: page.id,
            },
          },
          update: {
            pageName: page.name,
            about: page.about ?? null,
            pictureUrl: page.picture?.data?.url ?? null,
            encryptedAccessToken: encryptedToken,
            isActive: true,
            updatedAt: new Date(),
          },
          create: {
            workspaceId: membership.workspaceId,
            pageId: page.id,
            pageName: page.name,
            about: page.about ?? null,
            pictureUrl: page.picture?.data?.url ?? null,
            encryptedAccessToken: encryptedToken,
            isActive: true,
            webhookSubscribed: false,
          },
        });

        // Subscribe the page to receive Messenger events via our webhook
        // This can fail if the app hasn't been through App Review yet —
        // we log the error but don't block the connection.
        try {
          await subscribePageToWebhook(page.id, page.access_token);
          await prisma.facebookPage.updateMany({
            where: {
              workspaceId: membership.workspaceId,
              pageId: page.id,
            },
            data: { webhookSubscribed: true },
          });
        } catch (subErr) {
          // Non-fatal: page is connected but webhook isn't subscribed yet.
          // The UI will show a warning prompting the user to complete App Review.
          console.warn(
            `[fb-callback] Webhook subscription failed for page ${page.id}:`,
            subErr instanceof GraphApiError ? subErr.message : subErr
          );
        }

        connectedCount++;
      } catch (pageErr) {
        console.error(`[fb-callback] Failed to connect page ${page.id}:`, pageErr);
        errors.push(page.name);
      }
    }

    // Clear the CSRF state cookie
    const redirectUrl = new URL(
      `/dashboard/pages?connected=${connectedCount}`,
      req.url
    );
    if (errors.length > 0) {
      redirectUrl.searchParams.set("failed", errors.join(","));
    }

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete("fb_oauth_state");
    return response;
  } catch (err) {
    console.error("[fb-callback] Unexpected error:", err);
    return NextResponse.redirect(
      new URL("/dashboard/pages?error=unexpected", req.url)
    );
  }
}
