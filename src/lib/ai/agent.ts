// AI agent orchestrator.
// This module ties together: prompt building, Claude, conversation memory,
// language detection, and handoff logic. The Inngest function calls runAgent().

import type { AgentConfig, Message } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { buildSystemPrompt } from "./buildSystemPrompt";
import { callClaude, summarizeConversation, parseAgentReply, type ClaudeMessage } from "./claude";
import type { AgentResponse } from "@/types";

// Keep the last N messages in the live prompt window.
// Older messages get summarized into contextSummary to stay within token budget.
const MESSAGE_HISTORY_LIMIT = 20;

// ─── Language detection ───────────────────────────────────────────────────────

/**
 * Detects whether a message is primarily Bengali or English.
 * Uses Unicode range check — Bengali characters are U+0980–U+09FF.
 * This is fast, zero-cost, and works offline — no API call needed.
 */
export function detectLanguage(text: string): "bn" | "en" | "unknown" {
  const bengaliChars = (text.match(/[\u0980-\u09FF]/g) ?? []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) ?? []).length;

  if (bengaliChars === 0 && latinChars === 0) return "unknown";
  // If >30% of alphabetic characters are Bengali, treat as Bengali
  return bengaliChars / (bengaliChars + latinChars) > 0.3 ? "bn" : "en";
}

// ─── Memory management ────────────────────────────────────────────────────────

interface ConversationMemory {
  messages: ClaudeMessage[];
  contextSummary: string | null;
}

/**
 * Loads conversation history from the DB and manages the context window.
 * If the conversation has more than MESSAGE_HISTORY_LIMIT messages, the older
 * ones are summarized and stored as contextSummary, keeping the prompt lean.
 */
async function loadConversationMemory(
  conversationId: string,
  config: AgentConfig,
  existingSummary: string | null
): Promise<ConversationMemory> {
  const allMessages = await prisma.message.findMany({
    where: { conversationId, role: { in: ["user", "assistant"] } },
    orderBy: { createdAt: "asc" },
  });

  // Only keep the most recent N messages in the live window
  const recentMessages = allMessages.slice(-MESSAGE_HISTORY_LIMIT);
  const olderMessages = allMessages.slice(0, -MESSAGE_HISTORY_LIMIT);

  let contextSummary = existingSummary;

  // If there are older messages not yet summarized, summarize them now
  if (olderMessages.length > 0) {
    const toSummarize: ClaudeMessage[] = olderMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // If we already have a summary, prepend it so the new summary builds on it
    if (contextSummary) {
      toSummarize.unshift({
        role: "user",
        content: `[Previous summary: ${contextSummary}]`,
      });
    }

    contextSummary = await summarizeConversation(toSummarize, config.businessName);

    // Persist the updated summary so we don't re-summarize on the next message
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { contextSummary },
    });
  }

  return {
    messages: recentMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    contextSummary,
  };
}

// ─── Main agent entry point ───────────────────────────────────────────────────

interface RunAgentOptions {
  conversationId: string;
  inboundMessage: string;
  config: AgentConfig;
  customerName: string | null;
  existingSummary: string | null;
}

/**
 * Runs the full AI agent pipeline for one inbound message:
 * 1. Detect language
 * 2. Load conversation memory (with summarization if needed)
 * 3. Build system prompt
 * 4. Call Claude
 * 5. Parse reply for handoff signals
 * 6. Return structured AgentResponse
 */
export async function runAgent({
  conversationId,
  inboundMessage,
  config,
  customerName,
  existingSummary,
}: RunAgentOptions): Promise<AgentResponse> {
  // 1. Detect language from the customer's message
  const detectedLanguage = detectLanguage(inboundMessage);

  // 2. Load memory — recent messages + optional summary of older context
  const memory = await loadConversationMemory(
    conversationId,
    config,
    existingSummary
  );

  // 3. Build the system prompt with all business context injected
  const systemPrompt = buildSystemPrompt({
    config,
    contextSummary: memory.contextSummary,
    customerName,
    detectedLanguage,
  });

  // 4. Append the new inbound message to the history for this call
  const messagesForClaude: ClaudeMessage[] = [
    ...memory.messages,
    { role: "user", content: inboundMessage },
  ];

  // 5. Call Claude
  const rawReply = await callClaude(systemPrompt, messagesForClaude);

  // 6. Parse for handoff signal
  return parseAgentReply(rawReply);
}
