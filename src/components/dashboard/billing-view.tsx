"use client";

// BillingView — handles all billing interactions client-side.
// Calls /api/stripe/checkout to start a new subscription.
// Calls /api/stripe/portal to open the Stripe Customer Portal for existing subscribers.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard, CheckCircle2, AlertCircle, Loader2,
  Zap, Check, ExternalLink,
} from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { subscriptionStatusLabel } from "@/lib/stripe/client";
import { cn } from "@/lib/utils";

interface WorkspaceBilling {
  id: string;
  name: string;
  subscriptionStatus: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
}

interface BillingViewProps {
  workspace: WorkspaceBilling | null;
  checkoutSuccess: boolean;
  checkoutCanceled: boolean;
}

const PLAN_FEATURES = [
  "Unlimited AI-handled conversations",
  "Up to 5 Facebook Pages",
  "Bengali & English language support",
  "Human takeover & live inbox",
  "Conversation analytics",
  "Priority support",
];

export function BillingView({ workspace, checkoutSuccess, checkoutCanceled }: BillingViewProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const status = workspace?.subscriptionStatus ?? null;
  const isActive = status === "active" || status === "trialing";
  const hasCustomer = !!workspace?.stripeCustomerId;

  useEffect(() => {
    if (checkoutSuccess) {
      setToast({ type: "success", message: "Subscription activated! Welcome to SalesBot AI Pro." });
      window.history.replaceState({}, "", "/dashboard/billing");
    } else if (checkoutCanceled) {
      setToast({ type: "info", message: "Checkout canceled — no charge was made." });
      window.history.replaceState({}, "", "/dashboard/billing");
    }
  }, [checkoutSuccess, checkoutCanceled]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create checkout session");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  async function handleManage() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to open billing portal");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  const statusBadgeVariant = (): "ai" | "hot_lead" | "closed" | "default" => {
    if (status === "active") return "ai";
    if (status === "trialing") return "hot_lead";
    if (status === "canceled") return "closed";
    return "default";
  };

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "flex items-start gap-3 px-4 py-3 rounded-[14px] text-sm border",
          toast.type === "success" && "bg-[rgb(var(--success)/0.1)] border-[rgb(var(--success)/0.3)] text-[rgb(var(--success))]",
          toast.type === "error" && "bg-[rgb(var(--danger)/0.1)] border-[rgb(var(--danger)/0.3)] text-[rgb(var(--danger))]",
          toast.type === "info" && "bg-[rgb(var(--accent)/0.1)] border-[rgb(var(--accent)/0.3)] text-[rgb(var(--accent))]",
        )}>
          {toast.type === "success" ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
          {toast.message}
        </div>
      )}

      {/* Current plan card */}
      <GlassPanel radius="xl" className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-[rgb(var(--text-primary))]">
                SalesBot AI Pro
              </h2>
              {status && (
                <Badge variant={statusBadgeVariant()}>
                  {subscriptionStatusLabel(status)}
                </Badge>
              )}
            </div>
            <p className="text-2xl font-bold text-[rgb(var(--text-primary))]">
              $49
              <span className="text-sm font-normal text-[rgb(var(--text-muted))]"> / month</span>
            </p>
            <p className="text-xs text-[rgb(var(--text-muted))]">
              7-day free trial included — cancel anytime
            </p>
          </div>
          <div className="w-12 h-12 rounded-[14px] bg-[rgb(var(--accent)/0.1)] flex items-center justify-center shrink-0">
            <Zap className="w-6 h-6 text-[rgb(var(--accent))]" />
          </div>
        </div>

        {/* Features */}
        <ul className="space-y-2">
          {PLAN_FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-2.5 text-sm text-[rgb(var(--text-secondary))]">
              <Check className="w-4 h-4 text-[rgb(var(--success))] shrink-0" />
              {feature}
            </li>
          ))}
        </ul>

        {/* Error */}
        {error && (
          <p className="text-sm text-[rgb(var(--danger))] bg-[rgb(var(--danger)/0.08)] px-3 py-2 rounded-[10px]">
            {error}
          </p>
        )}

        {/* CTA */}
        <div className="flex gap-3 pt-1">
          {!isActive ? (
            <Button size="lg" onClick={handleSubscribe} disabled={loading} className="flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              {loading ? "Redirecting…" : "Start free trial"}
            </Button>
          ) : (
            <Button variant="ghost" size="lg" onClick={handleManage} disabled={loading} className="flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              {loading ? "Opening portal…" : "Manage subscription"}
            </Button>
          )}
        </div>
      </GlassPanel>

      {/* Billing info */}
      {isActive && (
        <GlassPanel radius="xl" className="p-5 space-y-3">
          <h3 className="font-medium text-[rgb(var(--text-primary))]">Billing details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[rgb(var(--text-muted))]">Status</span>
              <span className="text-[rgb(var(--text-primary))] font-medium">
                {subscriptionStatusLabel(status)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[rgb(var(--text-muted))]">Workspace</span>
              <span className="text-[rgb(var(--text-primary))]">{workspace?.name}</span>
            </div>
          </div>
          <p className="text-xs text-[rgb(var(--text-muted))]">
            To update payment method, change plan, or cancel — use the{" "}
            <button
              onClick={handleManage}
              className="text-[rgb(var(--accent))] hover:underline"
            >
              billing portal
            </button>.
          </p>
        </GlassPanel>
      )}

      {/* Stripe trust badge */}
      <p className="text-center text-xs text-[rgb(var(--text-muted))]">
        Payments secured by{" "}
        <a
          href="https://stripe.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[rgb(var(--accent))] hover:underline"
        >
          Stripe
        </a>
        . We never store your card details.
      </p>
    </div>
  );
}
