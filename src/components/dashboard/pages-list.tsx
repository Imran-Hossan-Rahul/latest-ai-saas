"use client";

// PagesList — client component for the Facebook Pages dashboard.
// Handles all user interactions: connecting pages, toggling active state,
// and disconnecting pages with a confirmation dialog.

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  Trash2,
  Power,
  PowerOff,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Webhook,
  ExternalLink,
} from "lucide-react";
import type { FacebookPage } from "@prisma/client";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type PageWithCount = FacebookPage & { _count: { conversations: number } };

interface PagesListProps {
  initialPages: PageWithCount[];
  connected: number | null;
  oauthError: string | null;
}

// Human-readable OAuth error messages
const oauthErrorMessages: Record<string, string> = {
  permission_denied: "You declined the Facebook permissions. All permissions are required for the AI agent to work.",
  invalid_state: "The connection attempt expired or was tampered with. Please try again.",
  no_code: "Facebook did not return an authorization code. Please try again.",
  no_pages: "No Facebook Pages were found on your account. Make sure you manage at least one Page.",
  no_workspace: "Workspace not found. Please refresh and try again.",
  unexpected: "An unexpected error occurred. Please try again.",
};

export function PagesList({ initialPages, connected, oauthError }: PagesListProps) {
  const router = useRouter();
  const [pages, setPages] = useState(initialPages);
  const [isPending, startTransition] = useTransition();
  const [connectingPage, setConnectingPage] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Show toast from OAuth redirect result
  useEffect(() => {
    if (connected !== null && connected > 0) {
      showToast("success", `${connected} page${connected > 1 ? "s" : ""} connected successfully.`);
    } else if (oauthError) {
      showToast("error", oauthErrorMessages[oauthError] ?? oauthErrorMessages.unexpected);
    }
    // Clear query params from URL without re-render
    window.history.replaceState({}, "", "/dashboard/pages");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }

  function handleConnect() {
    setConnectingPage(true);
    // Redirect to our OAuth initiation route — it will redirect to Facebook
    window.location.href = "/api/facebook/connect";
  }

  async function handleToggleActive(page: PageWithCount) {
    setTogglingId(page.id);
    try {
      const res = await fetch(`/api/pages/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !page.isActive }),
      });
      if (!res.ok) throw new Error("Failed to update page");
      const data = await res.json();
      setPages((prev) =>
        prev.map((p) => (p.id === page.id ? { ...p, isActive: data.isActive } : p))
      );
      showToast(
        "success",
        `AI agent ${data.isActive ? "resumed" : "paused"} for ${page.pageName}.`
      );
    } catch {
      showToast("error", "Failed to update page status. Please try again.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDisconnect(pageId: string) {
    setDeletingId(pageId);
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/pages/${pageId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect page");
      setPages((prev) => prev.filter((p) => p.id !== pageId));
      showToast("success", "Page disconnected successfully.");
      // Refresh server component data
      startTransition(() => router.refresh());
    } catch {
      showToast("error", "Failed to disconnect page. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  const pageToDelete = pages.find((p) => p.id === confirmDeleteId);

  return (
    <div className="space-y-4">
      {/* Toast notification */}
      {toast && (
        <div
          className={`flex items-start gap-3 px-4 py-3 rounded-[14px] text-sm border ${
            toast.type === "success"
              ? "bg-[rgb(var(--success)/0.1)] border-[rgb(var(--success)/0.3)] text-[rgb(var(--success))]"
              : "bg-[rgb(var(--danger)/0.1)] border-[rgb(var(--danger)/0.3)] text-[rgb(var(--danger))]"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Connect button */}
      <div className="flex justify-end">
        <Button
          onClick={handleConnect}
          disabled={connectingPage}
          size="md"
        >
          {connectingPage ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          {connectingPage ? "Redirecting to Facebook…" : "Connect Facebook Page"}
        </Button>
      </div>

      {/* App Review notice */}
      <GlassPanel radius="lg" className="px-4 py-3 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-[rgb(var(--warning))] mt-0.5 shrink-0" />
        <div className="text-sm text-[rgb(var(--text-secondary))]">
          <span className="font-medium text-[rgb(var(--text-primary))]">Facebook App Review required</span>
          {" "}— permissions like{" "}
          <code className="text-xs bg-[rgb(var(--text-muted)/0.15)] px-1 py-0.5 rounded">pages_messaging</code>
          {" "}require App Review before going live. During development, add yourself as a{" "}
          <a
            href="https://developers.facebook.com/docs/development/build-and-test/test-users"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[rgb(var(--accent))] hover:underline inline-flex items-center gap-0.5"
          >
            Test User <ExternalLink className="w-3 h-3" />
          </a>
          {" "}to bypass review.
        </div>
      </GlassPanel>

      {/* Pages list */}
      {pages.length === 0 ? (
        <GlassPanel radius="xl" className="p-14 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-[18px] bg-[rgb(var(--accent)/0.1)] flex items-center justify-center">
            <MessageSquare className="w-7 h-7 text-[rgb(var(--accent))]" />
          </div>
          <div className="space-y-1">
            <p className="font-medium text-[rgb(var(--text-primary))]">No pages connected yet</p>
            <p className="text-sm text-[rgb(var(--text-secondary))] max-w-xs">
              Connect a Facebook Page to deploy your AI sales agent and start handling
              Messenger conversations automatically.
            </p>
          </div>
          <Button onClick={handleConnect} disabled={connectingPage} size="lg">
            {connectingPage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Connect your first Page
          </Button>
        </GlassPanel>
      ) : (
        <GlassPanel radius="xl" className="overflow-hidden">
          <ul className="divide-y divide-[rgb(var(--glass-border))]">
            {pages.map((page) => (
              <li key={page.id} className="flex items-center gap-4 px-5 py-4">
                {/* Page avatar */}
                {page.pictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={page.pictureUrl}
                    alt={page.pageName}
                    className="w-11 h-11 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-[rgb(var(--accent)/0.15)] flex items-center justify-center shrink-0">
                    <span className="text-base font-semibold text-[rgb(var(--accent))]">
                      {page.pageName[0]}
                    </span>
                  </div>
                )}

                {/* Page info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-[rgb(var(--text-primary))] truncate">
                      {page.pageName}
                    </span>
                    <Badge variant={page.isActive ? "ai" : "closed"}>
                      {page.isActive ? "Active" : "Paused"}
                    </Badge>
                    {!page.webhookSubscribed && (
                      <Badge variant="hot_lead">Webhook pending</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[rgb(var(--text-muted))]">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {page._count.conversations} conversations
                    </span>
                    {page.webhookSubscribed && (
                      <span className="flex items-center gap-1 text-[rgb(var(--success))]">
                        <Webhook className="w-3 h-3" />
                        Webhook active
                      </span>
                    )}
                    <span className="text-[rgb(var(--text-muted))]">
                      ID: {page.pageId}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleActive(page)}
                    disabled={togglingId === page.id}
                    title={page.isActive ? "Pause AI agent" : "Resume AI agent"}
                  >
                    {togglingId === page.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : page.isActive ? (
                      <PowerOff className="w-4 h-4 text-[rgb(var(--warning))]" />
                    ) : (
                      <Power className="w-4 h-4 text-[rgb(var(--success))]" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setConfirmDeleteId(page.id)}
                    disabled={deletingId === page.id}
                    title="Disconnect page"
                  >
                    {deletingId === page.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 text-[rgb(var(--danger))]" />
                    )}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </GlassPanel>
      )}

      {/* Disconnect confirmation dialog */}
      {confirmDeleteId && pageToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setConfirmDeleteId(null)}
          />
          <GlassPanel
            radius="xl"
            elevated
            className="relative z-10 w-full max-w-sm p-6 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[rgb(var(--danger)/0.1)] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-[rgb(var(--danger))]" />
              </div>
              <div>
                <h3 className="font-semibold text-[rgb(var(--text-primary))]">
                  Disconnect page?
                </h3>
                <p className="text-sm text-[rgb(var(--text-secondary))] mt-1">
                  <span className="font-medium">{pageToDelete.pageName}</span> will be
                  disconnected. All conversation history will be permanently deleted.
                  This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={() => handleDisconnect(confirmDeleteId)}
                disabled={!!deletingId}
              >
                {deletingId ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Disconnect
              </Button>
            </div>
          </GlassPanel>
        </div>
      )}
    </div>
  );
}
