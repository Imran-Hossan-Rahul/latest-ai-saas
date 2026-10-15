// Central type definitions — import from here, not from Prisma directly,
// so we can extend/transform shapes without touching every consumer.

import type {
  User,
  Workspace,
  FacebookPage,
  AgentConfig,
  Conversation,
  Message,
} from "@prisma/client";

// ─── Re-exports with common joins ────────────────────────────────────────────

export type WorkspaceWithPages = Workspace & {
  facebookPages: FacebookPage[];
};

export type ConversationWithMessages = Conversation & {
  messages: Message[];
  facebookPage: Pick<FacebookPage, "pageName" | "pictureUrl">;
};

export type ConversationSummary = Pick<
  Conversation,
  "id" | "customerPsid" | "customerName" | "customerPicUrl" | "status" | "tag" | "updatedAt"
> & {
  lastMessage: Pick<Message, "content" | "role" | "createdAt"> | null;
  facebookPage: Pick<FacebookPage, "pageName">;
};

// ─── Facebook Graph API shapes ────────────────────────────────────────────────

export interface FacebookPageInfo {
  id: string;
  name: string;
  about?: string;
  picture?: { data: { url: string } };
  access_token: string;
}

export interface FacebookMessengerMessage {
  mid: string;
  text?: string;
  attachments?: Array<{ type: string; payload: Record<string, unknown> }>;
}

export interface FacebookWebhookEntry {
  id: string; // page ID
  time: number;
  messaging: Array<{
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: FacebookMessengerMessage;
    postback?: { title: string; payload: string };
  }>;
}

export interface FacebookWebhookPayload {
  object: "page";
  entry: FacebookWebhookEntry[];
}

// ─── AI agent types ───────────────────────────────────────────────────────────

export interface AgentContext {
  config: AgentConfig;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  contextSummary: string | null;
  customerName: string | null;
}

export interface AgentResponse {
  reply: string;
  shouldHandOff: boolean;
  handOffReason?: string;
}

// ─── API response wrapper ─────────────────────────────────────────────────────

export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = { success: false; error: string };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Auth session extension ───────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

// ─── Dashboard analytics ──────────────────────────────────────────────────────

export interface PageAnalytics {
  totalConversations: number;
  aiHandled: number;
  humanHandled: number;
  avgResponseTimeMs: number;
  openConversations: number;
}
