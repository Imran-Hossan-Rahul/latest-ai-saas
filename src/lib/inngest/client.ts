// Inngest client singleton — Inngest v4 API.
// Import `inngest` from here whenever you need to send an event or define a function.
// The event key is read from INNGEST_EVENT_KEY — "local" works for local dev
// without an Inngest account (the Inngest dev server auto-discovers it).

import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "salesbot-ai",
  eventKey: process.env.INNGEST_EVENT_KEY ?? "local",
});

// Typed event data shapes — used in functions to get autocomplete on event.data
export interface MessengerMessageReceivedData {
  pageId: string;         // our internal FacebookPage.id (cuid)
  facebookPageId: string; // Facebook's numeric page ID string
  senderPsid: string;
  messageText: string | null;
  facebookMid: string;
  timestamp: number;
}
