"use client";

// InboxView — the full split-pane inbox UI.
// Left pane: filterable conversation list with status badges.
// Right pane: full message thread, takeover toggle, manual reply, tag selector.
//
// All mutations (takeover, reply, tag) call API routes and update local state
// optimistically so the UI feels instant.

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Bot, User, Send, Tag, ChevronDown,
  MessageSquare, Search, Loader2, UserCheck, BotOff,
} from "lucide-react";
import type { Conversation, Message, FacebookPage } from "@prisma/client";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ConvSummary = Conversation & {
  messages: Message[];
  facebookPage: Pick<FacebookPage, "pageName" | "pageId">;
};

type PageOption = Pick<FacebookPage, "id" | "pageName" | "pageId">;

interface InboxViewProps {
  initialConversations: ConvSummary[];
  pages: PageOption[];
  initialSelectedId: string | null;
}

const TAG_OPTIONS = [
  { value: null, label: "No tag" },
  { value: "hot_lead", label: "🔥 Hot lead" },
  { value: "closed", label: "✅ Closed" },
  { value: "spam", label: "🚫 Spam" },
] as const;

// ─── Conversation list item ───────────────────────────────────────────────────

function ConvItem({
  conv,
  isSelected,
  onClick,
}: {
  conv: ConvSummary;
  isSelected: boolean;
  onClick: () => void;
}) {
  const lastMsg = conv.messages[0];
  const initials = (conv.customerName ?? "?")[0].toUpperCase();

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors duration-150",
        isSelected
          ? "bg-[rgb(var(--accent)/0.1)] border-r-2 border-[rgb(var(--accent))]"
          : "hover:bg-white/5"
      )}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        {conv.customerPicUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={conv.customerPicUrl}
            alt={conv.customerName ?? "Customer"}
            className="w-9 h-9 rounded-full object-cover"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-[rgb(var(--accent)/0.15)] flex items-center justify-center">
            <span className="text-sm font-medium text-[rgb(var(--accent))]">{initials}</span>
          </div>
        )}
        {/* Status dot */}
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[rgb(var(--bg-base))]",
            conv.status === "ai"
              ? "bg-[rgb(var(--accent))]"
              : conv.status === "human"
              ? "bg-[rgb(var(--success))]"
              : "bg-[rgb(var(--text-muted))]"
          )}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-medium text-[rgb(var(--text-primary))] truncate">
            {conv.customerName ?? "Unknown"}
          </span>
          <span className="text-[10px] text-[rgb(var(--text-muted))] shrink-0">
            {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true })}
          </span>
        </div>
        <p className="text-xs text-[rgb(var(--text-muted))] truncate mt-0.5">
          {lastMsg
            ? `${lastMsg.role === "assistant" ? "You: " : ""}${lastMsg.content}`
            : "No messages yet"}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[10px] text-[rgb(var(--text-muted))]">
            {conv.facebookPage.pageName}
          </span>
          {conv.tag && (
            <Badge variant={conv.tag as "hot_lead" | "closed" | "spam"} className="text-[10px] py-0">
              {conv.tag.replace("_", " ")}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isAssistant = message.role === "assistant";
  return (
    <div className={cn("flex gap-2.5", isAssistant ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1",
          isAssistant
            ? "bg-[rgb(var(--accent)/0.15)]"
            : "bg-[rgb(var(--text-muted)/0.15)]"
        )}
      >
        {isAssistant ? (
          <Bot className="w-3.5 h-3.5 text-[rgb(var(--accent))]" />
        ) : (
          <User className="w-3.5 h-3.5 text-[rgb(var(--text-muted))]" />
        )}
      </div>
      <div
        className={cn(
          "max-w-[72%] px-3.5 py-2.5 rounded-[16px] text-sm leading-relaxed",
          isAssistant
            ? "bg-[rgb(var(--accent))] text-white rounded-tr-[4px]"
            : "glass rounded-tl-[4px] text-[rgb(var(--text-primary))]"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p
          className={cn(
            "text-[10px] mt-1",
            isAssistant ? "text-white/60 text-right" : "text-[rgb(var(--text-muted))]"
          )}
        >
          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

// ─── Main InboxView ───────────────────────────────────────────────────────────

export function InboxView({ initialConversations, pages, initialSelectedId }: InboxViewProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [togglingTakeover, setTogglingTakeover] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const tagMenuRef = useRef<HTMLDivElement>(null);

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;

  // ── Load messages when conversation changes ───────────────────────────────
  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
      }
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadMessages(selectedId);
      // Update URL without full navigation
      window.history.replaceState({}, "", `/dashboard/inbox?conversation=${selectedId}`);
    }
  }, [selectedId, loadMessages]);

  // ── Auto-scroll to bottom on new messages ────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Close tag menu on outside click ──────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (tagMenuRef.current && !tagMenuRef.current.contains(e.target as Node)) {
        setShowTagMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Filtered conversation list ────────────────────────────────────────────
  const filteredConvs = conversations.filter((c) => {
    const matchesStatus = filterStatus === "all" || c.status === filterStatus;
    const matchesSearch =
      !searchQuery ||
      (c.customerName ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.facebookPage.pageName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // ── Takeover toggle ───────────────────────────────────────────────────────
  async function handleTakeover() {
    if (!selectedConv) return;
    setTogglingTakeover(true);
    const newStatus = selectedConv.status === "human" ? "ai" : "human";
    try {
      const res = await fetch(`/api/conversations/${selectedConv.id}/takeover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedConv.id ? { ...c, status: newStatus } : c))
        );
        router.refresh();
      }
    } finally {
      setTogglingTakeover(false);
    }
  }

  // ── Manual reply ──────────────────────────────────────────────────────────
  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedConv || !replyText.trim()) return;
    setSendingReply(true);
    const text = replyText.trim();
    setReplyText("");
    try {
      const res = await fetch(`/api/conversations/${selectedConv.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConv.id
              ? { ...c, messages: [data.message], updatedAt: new Date() }
              : c
          )
        );
      }
    } finally {
      setSendingReply(false);
    }
  }

  // ── Tag conversation ──────────────────────────────────────────────────────
  async function handleTag(tag: string | null) {
    if (!selectedConv) return;
    setShowTagMenu(false);
    const res = await fetch(`/api/conversations/${selectedConv.id}/tag`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag }),
    });
    if (res.ok) {
      setConversations((prev) =>
        prev.map((c) => (c.id === selectedConv.id ? { ...c, tag } : c))
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Left pane: conversation list ─────────────────────────────────── */}
      <div className="w-80 shrink-0 flex flex-col border-r border-[rgb(var(--glass-border))] bg-[rgb(var(--bg-base))]">
        {/* Header */}
        <div className="px-4 pt-5 pb-3 space-y-3">
          <h1 className="text-lg font-semibold text-[rgb(var(--text-primary))]">Inbox</h1>
          <Input
            placeholder="Search conversations…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-3.5 h-3.5" />}
            className="h-8 text-xs"
          />
          {/* Status filter tabs */}
          <div className="flex gap-1">
            {["all", "ai", "human", "closed"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  "flex-1 py-1 text-xs rounded-[8px] font-medium transition-colors",
                  filterStatus === s
                    ? "bg-[rgb(var(--accent))] text-white"
                    : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]"
                )}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[rgb(var(--glass-border))]">
          {filteredConvs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 px-4 text-center">
              <MessageSquare className="w-8 h-8 text-[rgb(var(--text-muted))]" />
              <p className="text-sm text-[rgb(var(--text-muted))]">
                {searchQuery ? "No conversations match your search." : "No conversations yet."}
              </p>
            </div>
          ) : (
            filteredConvs.map((conv) => (
              <ConvItem
                key={conv.id}
                conv={conv}
                isSelected={conv.id === selectedId}
                onClick={() => setSelectedId(conv.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right pane: thread ───────────────────────────────────────────── */}
      {selectedConv ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Thread header */}
          <GlassPanel
            flat
            radius="sm"
            className="flex items-center gap-3 px-5 py-3.5 border-b border-[rgb(var(--glass-border))] rounded-none shrink-0"
          >
            {/* Customer avatar */}
            {selectedConv.customerPicUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedConv.customerPicUrl}
                alt={selectedConv.customerName ?? "Customer"}
                className="w-9 h-9 rounded-full object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[rgb(var(--accent)/0.15)] flex items-center justify-center shrink-0">
                <span className="text-sm font-medium text-[rgb(var(--accent))]">
                  {(selectedConv.customerName ?? "?")[0].toUpperCase()}
                </span>
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="font-medium text-[rgb(var(--text-primary))] truncate">
                {selectedConv.customerName ?? "Unknown Customer"}
              </p>
              <p className="text-xs text-[rgb(var(--text-muted))] truncate">
                {selectedConv.facebookPage.pageName} · PSID {selectedConv.customerPsid}
              </p>
            </div>

            {/* Tag selector */}
            <div className="relative" ref={tagMenuRef}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTagMenu((v) => !v)}
                className="gap-1.5"
              >
                <Tag className="w-3.5 h-3.5" />
                {selectedConv.tag
                  ? TAG_OPTIONS.find((t) => t.value === selectedConv.tag)?.label ?? selectedConv.tag
                  : "Tag"}
                <ChevronDown className="w-3 h-3" />
              </Button>
              {showTagMenu && (
                <GlassPanel
                  elevated
                  radius="md"
                  className="absolute right-0 top-full mt-1 w-40 py-1 z-20"
                >
                  {TAG_OPTIONS.map((opt) => (
                    <button
                      key={String(opt.value)}
                      onClick={() => handleTag(opt.value)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/10",
                        selectedConv.tag === opt.value
                          ? "text-[rgb(var(--accent))] font-medium"
                          : "text-[rgb(var(--text-primary))]"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </GlassPanel>
              )}
            </div>

            {/* Takeover toggle */}
            <Button
              variant={selectedConv.status === "human" ? "primary" : "ghost"}
              size="sm"
              onClick={handleTakeover}
              disabled={togglingTakeover}
              className="gap-1.5 shrink-0"
            >
              {togglingTakeover ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : selectedConv.status === "human" ? (
                <Bot className="w-3.5 h-3.5" />
              ) : (
                <UserCheck className="w-3.5 h-3.5" />
              )}
              {selectedConv.status === "human" ? "Resume AI" : "Take over"}
            </Button>
          </GlassPanel>

          {/* Status banner when in human mode */}
          {selectedConv.status === "human" && (
            <div className="flex items-center gap-2 px-5 py-2 bg-[rgb(var(--success)/0.08)] border-b border-[rgb(var(--success)/0.2)] text-xs text-[rgb(var(--success))]">
              <BotOff className="w-3.5 h-3.5" />
              AI agent paused — you are replying directly. Click &quot;Resume AI&quot; to hand back.
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            {loadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-[rgb(var(--text-muted))]" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                <MessageSquare className="w-8 h-8 text-[rgb(var(--text-muted))]" />
                <p className="text-sm text-[rgb(var(--text-muted))]">No messages yet.</p>
              </div>
            ) : (
              messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply box — only shown when owner has taken over */}
          {selectedConv.status === "human" && (
            <form
              onSubmit={handleSendReply}
              className="flex items-end gap-2 px-4 py-3 border-t border-[rgb(var(--glass-border))]"
            >
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendReply(e as unknown as React.FormEvent);
                  }
                }}
                placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                rows={2}
                className={cn(
                  "flex-1 glass rounded-[12px] px-3.5 py-2.5 text-sm resize-none",
                  "text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))]",
                  "focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
                )}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!replyText.trim() || sendingReply}
                className="shrink-0 h-10 w-10"
              >
                {sendingReply ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
          )}

          {/* AI mode footer */}
          {selectedConv.status === "ai" && (
            <div className="flex items-center gap-2 px-5 py-3 border-t border-[rgb(var(--glass-border))] text-xs text-[rgb(var(--text-muted))]">
              <Bot className="w-3.5 h-3.5 text-[rgb(var(--accent))]" />
              AI agent is handling this conversation. Click &quot;Take over&quot; to reply manually.
            </div>
          )}
        </div>
      ) : (
        /* Empty state — no conversation selected */
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
          <div className="w-14 h-14 rounded-[18px] bg-[rgb(var(--accent)/0.1)] flex items-center justify-center">
            <MessageSquare className="w-7 h-7 text-[rgb(var(--accent))]" />
          </div>
          <p className="font-medium text-[rgb(var(--text-primary))]">Select a conversation</p>
          <p className="text-sm text-[rgb(var(--text-secondary))] max-w-xs">
            Choose a conversation from the list to view the full thread and manage the AI agent.
          </p>
        </div>
      )}
    </div>
  );
}
