// Facebook Graph API client.
// Every call to the Graph API goes through this module — no raw fetch elsewhere.
// This makes it easy to swap API versions, add retries, or mock in tests.

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

// ─── Generic request helper ───────────────────────────────────────────────────

async function graphRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = path.startsWith("http") ? path : `${GRAPH_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    const msg = data.error?.message ?? `Graph API error (${res.status})`;
    throw new GraphApiError(msg, data.error?.code, data.error?.type);
  }

  return data as T;
}

// Typed error so callers can distinguish Graph API failures from network errors
export class GraphApiError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly type?: string
  ) {
    super(message);
    this.name = "GraphApiError";
  }
}

// ─── OAuth ────────────────────────────────────────────────────────────────────

/**
 * Builds the Facebook OAuth dialog URL.
 * We request page-level permissions so the user can select which pages to connect.
 */
export function buildOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/facebook/callback`,
    scope: [
      "pages_show_list",
      "pages_messaging",
      "pages_manage_metadata",
      "pages_read_engagement",
      "pages_manage_engagement",
    ].join(","),
    response_type: "code",
    state,
  });
  return `https://www.facebook.com/dialog/oauth?${params}`;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

/**
 * Exchanges an OAuth authorization code for a user access token.
 */
export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  return graphRequest<TokenResponse>("/oauth/access_token", {
    method: "GET",
    // GET with query params — Graph API uses GET for token exchange
    headers: {},
  }).catch(() => {
    // Rebuild as GET with params in URL
    const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
    url.searchParams.set("client_id", process.env.FACEBOOK_APP_ID!);
    url.searchParams.set("client_secret", process.env.FACEBOOK_APP_SECRET!);
    url.searchParams.set("redirect_uri", `${process.env.NEXTAUTH_URL}/api/facebook/callback`);
    url.searchParams.set("code", code);
    return graphRequest<TokenResponse>(url.toString());
  });
}

// Cleaner direct implementation — the above catch pattern is awkward
export async function exchangeCode(code: string): Promise<TokenResponse> {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", process.env.FACEBOOK_APP_ID!);
  url.searchParams.set("client_secret", process.env.FACEBOOK_APP_SECRET!);
  url.searchParams.set("redirect_uri", `${process.env.NEXTAUTH_URL}/api/facebook/callback`);
  url.searchParams.set("code", code);
  return graphRequest<TokenResponse>(url.toString());
}

// ─── Page data ────────────────────────────────────────────────────────────────

export interface GraphPage {
  id: string;
  name: string;
  about?: string;
  access_token: string;
  picture?: { data: { url: string } };
}

interface PagesResponse {
  data: GraphPage[];
}

/**
 * Fetches all pages the user manages, including their page-level access tokens.
 * The user token must have pages_show_list permission.
 */
export async function getUserPages(userAccessToken: string): Promise<GraphPage[]> {
  const url = new URL(`${GRAPH_BASE}/me/accounts`);
  url.searchParams.set("access_token", userAccessToken);
  url.searchParams.set("fields", "id,name,about,access_token,picture");
  const res = await graphRequest<PagesResponse>(url.toString());
  return res.data;
}

/**
 * Fetches a single page's public info using its page-level access token.
 */
export async function getPageInfo(pageId: string, pageAccessToken: string): Promise<GraphPage> {
  const url = new URL(`${GRAPH_BASE}/${pageId}`);
  url.searchParams.set("access_token", pageAccessToken);
  url.searchParams.set("fields", "id,name,about,picture");
  return graphRequest<GraphPage>(url.toString());
}

// ─── Webhook subscription ─────────────────────────────────────────────────────

interface SubscriptionResponse {
  success: boolean;
}

/**
 * Subscribes a page to receive Messenger webhook events.
 * Must be called after connecting a page — without this, no messages arrive.
 *
 * ⚠️ Requires pages_manage_metadata permission (App Review required).
 */
export async function subscribePageToWebhook(
  pageId: string,
  pageAccessToken: string
): Promise<void> {
  const url = new URL(`${GRAPH_BASE}/${pageId}/subscribed_apps`);
  url.searchParams.set("access_token", pageAccessToken);
  url.searchParams.set("subscribed_fields", "messages,messaging_postbacks");

  const res = await graphRequest<SubscriptionResponse>(url.toString(), {
    method: "POST",
  });

  if (!res.success) {
    throw new GraphApiError(`Failed to subscribe page ${pageId} to webhook`);
  }
}

/**
 * Unsubscribes a page from webhook events (called on page disconnect).
 */
export async function unsubscribePageFromWebhook(
  pageId: string,
  pageAccessToken: string
): Promise<void> {
  const url = new URL(`${GRAPH_BASE}/${pageId}/subscribed_apps`);
  url.searchParams.set("access_token", pageAccessToken);
  await graphRequest(url.toString(), { method: "DELETE" });
}

// ─── Sending messages ─────────────────────────────────────────────────────────

/**
 * Sends a text message to a customer via the Send API.
 * This is called by the AI agent after generating a reply.
 */
export async function sendMessage(
  recipientPsid: string,
  text: string,
  pageAccessToken: string
): Promise<void> {
  const url = new URL(`${GRAPH_BASE}/me/messages`);
  url.searchParams.set("access_token", pageAccessToken);

  await graphRequest(url.toString(), {
    method: "POST",
    body: JSON.stringify({
      recipient: { id: recipientPsid },
      message: { text },
      // Mark as RESPONSE so it works within the 24-hour messaging window
      messaging_type: "RESPONSE",
    }),
  });
}

// ─── Customer profile ─────────────────────────────────────────────────────────

export interface CustomerProfile {
  name?: string;
  profile_pic?: string;
}

/**
 * Fetches a customer's public profile using their PSID.
 * Used to populate customerName/customerPicUrl on first contact.
 *
 * Note: Profile API access requires approved pages_messaging permission.
 */
export async function getCustomerProfile(
  psid: string,
  pageAccessToken: string
): Promise<CustomerProfile> {
  const url = new URL(`${GRAPH_BASE}/${psid}`);
  url.searchParams.set("access_token", pageAccessToken);
  url.searchParams.set("fields", "name,profile_pic");
  return graphRequest<CustomerProfile>(url.toString());
}
