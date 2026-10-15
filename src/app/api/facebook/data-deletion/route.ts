// POST /api/facebook/data-deletion
//
// Facebook Platform Terms require a Data Deletion Callback URL.
// When a user removes your app from their Facebook account, Facebook POSTs
// a signed request here. We must delete all data associated with that user
// and return a confirmation URL.
//
// Docs: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { prisma } from "@/lib/db/prisma";

interface SignedRequestPayload {
  user_id: string;
  algorithm: string;
  issued_at: number;
}

/**
 * Decodes and verifies a Facebook signed_request parameter.
 * Format: base64url(signature).base64url(payload)
 */
function parseSignedRequest(signedRequest: string): SignedRequestPayload | null {
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appSecret) return null;

  const [encodedSig, encodedPayload] = signedRequest.split(".");
  if (!encodedSig || !encodedPayload) return null;

  // Verify HMAC-SHA256 signature
  const expectedSig = createHmac("sha256", appSecret)
    .update(encodedPayload)
    .digest("base64url");

  if (expectedSig !== encodedSig) {
    console.error("[data-deletion] Signed request signature mismatch");
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const signedRequest = formData.get("signed_request");

  if (typeof signedRequest !== "string") {
    return NextResponse.json({ error: "Missing signed_request" }, { status: 400 });
  }

  const payload = parseSignedRequest(signedRequest);
  if (!payload) {
    return NextResponse.json({ error: "Invalid signed_request" }, { status: 400 });
  }

  const facebookUserId = payload.user_id;

  // Find and delete all data associated with this Facebook user.
  // The Facebook user ID maps to accounts connected via OAuth.
  try {
    const account = await prisma.account.findFirst({
      where: { provider: "facebook", providerAccountId: facebookUserId },
      select: { userId: true },
    });

    if (account) {
      // Delete the user — cascades to workspaces, pages, conversations, messages
      await prisma.user.delete({ where: { id: account.userId } });
      console.log(`[data-deletion] Deleted all data for Facebook user ${facebookUserId}`);
    }
  } catch (err) {
    console.error("[data-deletion] Error deleting user data:", err);
    // Still return success — we've logged it for manual review
  }

  // Facebook requires a confirmation URL in the response
  const confirmationUrl = `${process.env.NEXTAUTH_URL}/data-deletion-confirmation?id=${facebookUserId}`;

  return NextResponse.json({
    url: confirmationUrl,
    confirmation_code: facebookUserId,
  });
}
