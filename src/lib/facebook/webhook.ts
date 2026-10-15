// Facebook webhook signature verification.
//
// Facebook signs every webhook POST with HMAC-SHA256 using your App Secret.
// The signature is in the X-Hub-Signature-256 header as "sha256=<hex>".
// We MUST verify this before processing — otherwise anyone can POST fake events.
//
// We use a timing-safe comparison (timingSafeEqual) to prevent timing attacks.

import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifies the X-Hub-Signature-256 header on an incoming Facebook webhook request.
 *
 * @param rawBody  The raw request body as a Buffer (must be raw — not parsed JSON)
 * @param signature  The value of the X-Hub-Signature-256 header
 * @returns true if the signature is valid, false otherwise
 */
export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appSecret) {
    console.error("[webhook] FACEBOOK_APP_SECRET is not set — cannot verify signature");
    return false;
  }

  if (!signature.startsWith("sha256=")) {
    return false;
  }

  const receivedHex = signature.slice("sha256=".length);
  const expectedHmac = createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  // timingSafeEqual prevents timing-based attacks that could leak the secret
  try {
    return timingSafeEqual(
      Buffer.from(receivedHex, "hex"),
      Buffer.from(expectedHmac, "hex")
    );
  } catch {
    // Buffer lengths differ — signature is definitely invalid
    return false;
  }
}
