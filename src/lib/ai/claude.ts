// Anthropic Claude client wrapper.
// All calls to the Claude API go through this module.
// Using claude-3-5-sonnet — best balance of speed, cost, and quality for
// real-time sales conversations. Swap the model constant to upgrade globally.

import Anthropic from "@anthropic-ai/sdk";
import type { AgentResponse } from "@/types";

const MODEL = "claude-3-5-sonnet-20241022";

// Singleton client — reused across requests in the same process
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Calls Claude with a system prompt and conversation history.
 * Returns the raw text response.
 *
 * Max tokens is kept low (400) intentionally — sales chat replies should be
 * concise, like a real human texting, not essay-length paragraphs.
 */
export async function callClaude(
  systemPrompt: string,
  messages: ClaudeMessage[],
  maxTokens = 400
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error(`Unexpected Claude response type: ${block.type}`);
  }

  return block.text.trim();
}

/**
 * Summarizes a long conversation history into a compact paragraph.
 * Called when a conversation exceeds MESSAGE_HISTORY_LIMIT to keep prompts
 * within token budget without losing context.
 */
export async function summarizeConversation(
  messages: ClaudeMessage[],
  businessName: string
): Promise<string> {
  const transcript = messages
    .map((m) => `${m.role === "user" ? "Customer" : "Agent"}: ${m.content}`)
    .join("\n");

  const prompt = `Summarize this sales conversation between a customer and ${businessName}'s sales agent. 
Keep it under 150 words. Focus on: what the customer wants, any objections raised, 
what was agreed, and the current stage of the sale.

Conversation:
${transcript}`;

  return callClaude(
    "You are a concise conversation summarizer. Output only the summary, no preamble.",
    [{ role: "user", content: prompt }],
    200
  );
}

/**
 * Parses the AI's raw reply to extract the message text and detect
 * whether the agent is signalling a human handoff.
 *
 * The system prompt instructs Claude to prefix handoff signals with [HANDOFF]:
 * so we can detect them reliably without a second API call.
 */
export function parseAgentReply(rawReply: string): AgentResponse {
  const HANDOFF_PREFIX = "[HANDOFF]:";

  if (rawReply.startsWith(HANDOFF_PREFIX)) {
    const reason = rawReply.slice(HANDOFF_PREFIX.length).trim();
    return {
      // Extract the human-readable part after the reason marker if present
      reply: reason.includes("|MSG|")
        ? reason.split("|MSG|")[1].trim()
        : "I'll connect you with our team right away.",
      shouldHandOff: true,
      handOffReason: reason.includes("|MSG|")
        ? reason.split("|MSG|")[0].trim()
        : reason,
    };
  }

  return { reply: rawReply, shouldHandOff: false };
}
