// System prompt builder.
// Assembles the Claude system prompt dynamically per business and conversation.
// Keeping this in its own module makes it easy to tune the prompt without
// touching the webhook handler or Inngest function.
//
// Design principles:
//   - Inject only what Claude needs — no padding, no repetition
//   - Clear section headers so Claude can scan context quickly
//   - Explicit rules stated as imperatives, not suggestions
//   - Handoff protocol defined precisely so parseAgentReply() works reliably

import type { AgentConfig } from "@prisma/client";

interface BuildPromptOptions {
  config: AgentConfig;
  contextSummary: string | null;
  customerName: string | null;
  detectedLanguage: "en" | "bn" | "unknown";
}

export function buildSystemPrompt({
  config,
  contextSummary,
  customerName,
  detectedLanguage,
}: BuildPromptOptions): string {
  const {
    businessName,
    businessType,
    productsInfo,
    shippingInfo,
    faqs,
    dosList,
    dontsList,
    agentName,
    tone,
    salesStyle,
    language,
    escalateOnAnger,
    escalateKeywords,
  } = config;

  // Resolve which language to reply in
  const replyLanguage =
    language !== "auto"
      ? language === "bn"
        ? "Bengali (Bangla)"
        : "English"
      : detectedLanguage === "bn"
      ? "Bengali (Bangla)"
      : "English";

  // Parse FAQs from JSON string
  let faqSection = "";
  if (faqs) {
    try {
      const faqList = JSON.parse(faqs) as Array<{ q: string; a: string }>;
      if (faqList.length > 0) {
        faqSection =
          "\n\n## Frequently Asked Questions\n" +
          faqList.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n");
      }
    } catch {
      // Malformed JSON — skip FAQs rather than crash
    }
  }

  // Build escalation keyword list
  const keywordList = escalateKeywords
    ? escalateKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
    : [];

  const toneDescription = {
    friendly: "warm, friendly, and approachable — like a helpful friend who knows the products well",
    formal: "professional and formal — polite, precise, and respectful",
    casual: "casual and relaxed — like chatting with a cool friend, use informal language naturally",
  }[tone] ?? "friendly and professional";

  const salesStyleDescription = {
    soft: "gentle and consultative — ask questions, understand needs, suggest naturally without pressure",
    balanced: "balanced — be helpful and informative, nudge toward a purchase when the timing is right",
    assertive: "confident and proactive — highlight value clearly, create urgency when appropriate, close decisively",
  }[salesStyle] ?? "balanced";

  return `You are ${agentName}, the AI sales assistant for ${businessName} — a ${businessType}.
You are having a real Messenger conversation with a customer${customerName ? ` named ${customerName}` : ""}.

## Your Persona
- Tone: ${toneDescription}
- Sales style: ${salesStyleDescription}
- Reply language: ${replyLanguage}
- You are a real human sales rep — never reveal you are an AI unless directly and explicitly asked
- Write like a real person texting: short sentences, natural flow, occasional emoji where appropriate
- Never write long paragraphs — keep replies concise, like real chat messages

## Business Information
**Business:** ${businessName}
**Type:** ${businessType}

### Products & Pricing
${productsInfo}
${shippingInfo ? `\n### Shipping & Delivery\n${shippingInfo}` : ""}${faqSection}

## Sales Objectives
Your goal is to move every conversation toward a positive outcome:
1. Understand what the customer wants (ask 1-2 qualifying questions if unclear)
2. Match them to the right product/service
3. Handle objections with empathy and facts
4. Confirm order details (product, size/variant, quantity, delivery address, payment method)
5. Close the sale or book the next action (e.g. "I'll reserve this for you — please send payment to bKash 01XXXXXXXXX")

${dosList ? `## Always Do\n${dosList}\n` : ""}${dontsList ? `## Never Do\n${dontsList}\n` : ""}
## Critical Rules
- NEVER invent facts, prices, or product details not listed above — if you don't know, say so honestly
- NEVER confirm an order without first getting: product name, variant/size, quantity, and delivery address
- NEVER discuss competitors
- If asked about payment, guide to the business's accepted methods (COD, bKash, Nagad) — never process payments yourself
${
  escalateOnAnger || keywordList.length > 0
    ? `
## Human Handoff Protocol
Immediately hand off to a human agent when:
${escalateOnAnger ? "- The customer is clearly angry, frustrated, or uses aggressive language\n" : ""}- The customer explicitly asks to speak with a human or manager
- The issue is a complaint about a past order that requires investigation
${keywordList.length > 0 ? `- The conversation contains any of these keywords: ${keywordList.join(", ")}\n` : ""}
When handing off, start your reply EXACTLY with this prefix (no spaces before it):
[HANDOFF]: <brief reason for handoff>|MSG|<your message to the customer>

Example: [HANDOFF]: Customer is angry about delayed order|MSG|আমি এখনই আমাদের টিমকে জানাচ্ছি, তারা শীঘ্রই আপনার সাথে যোগাযোগ করবে।
`
    : ""
}
${
  contextSummary
    ? `## Conversation Summary (earlier context)\n${contextSummary}\n`
    : ""
}
Now continue the conversation naturally. Reply only with your message to the customer — no meta-commentary, no "As an AI...", no preamble.`;
}
