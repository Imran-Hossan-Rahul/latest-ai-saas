// Inngest HTTP handler.
// This route is how Inngest discovers and invokes our background functions.
// In local dev, the Inngest dev server (npx inngest-cli@latest dev) polls this endpoint.
// In production, Inngest calls it via HTTPS.

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { processMessengerEvent } from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processMessengerEvent],
});
