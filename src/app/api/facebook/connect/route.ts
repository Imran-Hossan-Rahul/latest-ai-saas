// GET /api/facebook/connect
// Initiates the Facebook OAuth flow.
//
// We generate a random CSRF state token, store it in a short-lived cookie,
// then redirect the user to Facebook's OAuth dialog. The callback route
// validates the state to prevent CSRF attacks.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomBytes } from "crypto";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { buildOAuthUrl } from "@/lib/facebook/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Generate a random state token to prevent CSRF
  const state = randomBytes(16).toString("hex");

  const oauthUrl = buildOAuthUrl(state);

  const response = NextResponse.redirect(oauthUrl);

  // Store state in a secure, httpOnly cookie (expires in 10 minutes)
  response.cookies.set("fb_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });

  return response;
}
