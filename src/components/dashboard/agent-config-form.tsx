"use client";

// AgentConfigForm — lets the owner configure the AI agent per Facebook Page.
// If multiple pages are connected, a tab selector switches between them.
// All fields map directly to the AgentConfig model.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, CheckCircle2, AlertCircle } from "lucide-react";
import type { FacebookPage, AgentConfig } from "@prisma/client";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PageWithConfig = FacebookPage & { agentConfig: AgentConfig | null };

interface AgentConfigFormProps {
  pages: PageWithConfig[];
}

// Default values for a new config
const DEFAULTS: Omit<AgentConfig, "id" | "facebookPageId" | "createdAt" | "updatedAt"> = {
  businessName: "",
  businessType: "",
  productsInfo: "",
  shippingInfo: null,
  faqs: null,
  dosList: null,
  dontsList: null,
  agentName: "Sales Assistant",
  tone: "friendly",
  salesStyle: "soft",
  language: "auto",
  escalateOnAnger: true,
  escalateKeywords: null,
};

function getInitialValues(config: AgentConfig | null) {
  if (!config) return { ...DEFAULTS };
  const { id, facebookPageId, createdAt, updatedAt, ...rest } = config;
  void id; void facebookPageId; void createdAt; void updatedAt;
  return { ...rest };
}

type FormValues = ReturnType<typeof getInitialValues>;

// Reusable labelled field wrapper
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-[rgb(var(--text-secondary))]">{label}</label>
      {children}
      {hint && <p className="text-xs text-[rgb(var(--text-muted))]">{hint}</p>}
    </div>
  );
}

// Reusable select styled to match the glass system
function GlassSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full h-10 glass rounded-[12px] px-3 text-sm text-[rgb(var(--text-primary))]",
        "focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]",
        "bg-transparent cursor-pointer"
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-[rgb(var(--surface))]">
          {o.label}
        </option>
      ))}
    </select>
  );
}

// Textarea styled to match the glass system
function GlassTextarea({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cn(
        "w-full glass rounded-[12px] px-3.5 py-2.5 text-sm resize-y",
        "text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))]",
        "focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
      )}
    />
  );
}

export function AgentConfigForm({ pages }: AgentConfigFormProps) {
  const router = useRouter();
  const [activePageId, setActivePageId] = useState(pages[0].id);
  const activePage = pages.find((p) => p.id === activePageId)!;

  const [values, setValues] = useState<FormValues>(
    getInitialValues(activePage.agentConfig)
  );
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<"success" | "error" | null>(null);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaveResult(null);
  }

  // Switch page tab — load that page's config into the form
  function switchPage(pageId: string) {
    setActivePageId(pageId);
    const page = pages.find((p) => p.id === pageId)!;
    setValues(getInitialValues(page.agentConfig));
    setSaveResult(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch(`/api/agent-config/${activePageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      setSaveResult(res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    } catch {
      setSaveResult("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* Page tabs */}
      {pages.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {pages.map((page) => (
            <button
              key={page.id}
              type="button"
              onClick={() => switchPage(page.id)}
              className={cn(
                "px-4 py-2 rounded-[12px] text-sm font-medium transition-all",
                activePageId === page.id
                  ? "bg-[rgb(var(--accent))] text-white"
                  : "glass text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]"
              )}
            >
              {page.pageName}
            </button>
          ))}
        </div>
      )}

      {/* ── Section: Business Info ─────────────────────────────────────── */}
      <GlassPanel radius="xl" className="p-5 space-y-4">
        <h2 className="font-semibold text-[rgb(var(--text-primary))]">Business Information</h2>
        <p className="text-xs text-[rgb(var(--text-muted))] -mt-2">
          This is injected directly into the AI&apos;s context — be specific and accurate.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Business name">
            <Input
              value={values.businessName}
              onChange={(e) => set("businessName", e.target.value)}
              placeholder="e.g. Dhaka Fashion House"
              required
            />
          </Field>
          <Field label="Business type">
            <Input
              value={values.businessType}
              onChange={(e) => set("businessType", e.target.value)}
              placeholder="e.g. clothing store, electronics shop"
              required
            />
          </Field>
        </div>

        <Field
          label="Products & pricing"
          hint="List every product with price, variants, and availability. The AI will only sell what you list here."
        >
          <GlassTextarea
            value={values.productsInfo}
            onChange={(v) => set("productsInfo", v)}
            placeholder={"T-Shirt: 500 BDT (S/M/L/XL, white/black/navy)\nJeans: 1200 BDT (28-36 waist, slim/regular)"}
            rows={5}
          />
        </Field>

        <Field label="Shipping & delivery" hint="Optional — leave blank if not applicable.">
          <GlassTextarea
            value={values.shippingInfo ?? ""}
            onChange={(v) => set("shippingInfo", v || null)}
            placeholder="Dhaka: 1-2 days (60 BDT). Outside Dhaka: 3-5 days (120 BDT). Free delivery above 1500 BDT."
            rows={2}
          />
        </Field>
      </GlassPanel>

      {/* ── Section: Persona ───────────────────────────────────────────── */}
      <GlassPanel radius="xl" className="p-5 space-y-4">
        <h2 className="font-semibold text-[rgb(var(--text-primary))]">Agent Persona</h2>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Agent name" hint="The name the AI uses when introducing itself.">
            <Input
              value={values.agentName}
              onChange={(e) => set("agentName", e.target.value)}
              placeholder="e.g. Riya, Arif, Sales Team"
            />
          </Field>
          <Field label="Reply language">
            <GlassSelect
              value={values.language}
              onChange={(v) => set("language", v as FormValues["language"])}
              options={[
                { value: "auto", label: "Auto-detect (Bengali / English)" },
                { value: "en", label: "Always English" },
                { value: "bn", label: "Always Bengali" },
              ]}
            />
          </Field>
          <Field label="Tone">
            <GlassSelect
              value={values.tone}
              onChange={(v) => set("tone", v as FormValues["tone"])}
              options={[
                { value: "friendly", label: "Friendly & warm" },
                { value: "formal", label: "Professional & formal" },
                { value: "casual", label: "Casual & relaxed" },
              ]}
            />
          </Field>
          <Field label="Sales style">
            <GlassSelect
              value={values.salesStyle}
              onChange={(v) => set("salesStyle", v as FormValues["salesStyle"])}
              options={[
                { value: "soft", label: "Soft — consultative, no pressure" },
                { value: "balanced", label: "Balanced — helpful with nudges" },
                { value: "assertive", label: "Assertive — confident closer" },
              ]}
            />
          </Field>
        </div>
      </GlassPanel>

      {/* ── Section: FAQs & Rules ──────────────────────────────────────── */}
      <GlassPanel radius="xl" className="p-5 space-y-4">
        <h2 className="font-semibold text-[rgb(var(--text-primary))]">FAQs & Rules</h2>

        <Field
          label="FAQs (JSON)"
          hint='Format: [{"q":"Question?","a":"Answer."}] — the AI will use these verbatim.'
        >
          <GlassTextarea
            value={values.faqs ?? ""}
            onChange={(v) => set("faqs", v || null)}
            placeholder={'[{"q":"Do you do COD?","a":"Yes, we accept COD, bKash, and Nagad."}]'}
            rows={4}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Always do" hint="One rule per line.">
            <GlassTextarea
              value={values.dosList ?? ""}
              onChange={(v) => set("dosList", v || null)}
              placeholder={"Always confirm size before placing order\nAlways mention free delivery threshold"}
              rows={3}
            />
          </Field>
          <Field label="Never do" hint="One rule per line.">
            <GlassTextarea
              value={values.dontsList ?? ""}
              onChange={(v) => set("dontsList", v || null)}
              placeholder={"Never promise same-day delivery\nNever discuss competitor pricing"}
              rows={3}
            />
          </Field>
        </div>
      </GlassPanel>

      {/* ── Section: Escalation ───────────────────────────────────────── */}
      <GlassPanel radius="xl" className="p-5 space-y-4">
        <h2 className="font-semibold text-[rgb(var(--text-primary))]">Human Handoff</h2>

        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-medium text-[rgb(var(--text-primary))]">
              Escalate on angry messages
            </p>
            <p className="text-xs text-[rgb(var(--text-muted))]">
              AI hands off when it detects frustration or aggression
            </p>
          </div>
          <button
            type="button"
            onClick={() => set("escalateOnAnger", !values.escalateOnAnger)}
            className={cn(
              "relative w-11 h-6 rounded-full transition-colors duration-200",
              values.escalateOnAnger
                ? "bg-[rgb(var(--accent))]"
                : "bg-[rgb(var(--text-muted)/0.3)]"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200",
                values.escalateOnAnger ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>

        <Field
          label="Escalation keywords"
          hint="Comma-separated words that trigger an immediate handoff (e.g. refund, complaint, manager)."
        >
          <Input
            value={values.escalateKeywords ?? ""}
            onChange={(e) => set("escalateKeywords", e.target.value || null)}
            placeholder="refund, complaint, manager, cancel, fraud"
          />
        </Field>
      </GlassPanel>

      {/* Save bar */}
      <div className="flex items-center justify-between">
        {saveResult === "success" && (
          <span className="flex items-center gap-1.5 text-sm text-[rgb(var(--success))]">
            <CheckCircle2 className="w-4 h-4" /> Saved successfully
          </span>
        )}
        {saveResult === "error" && (
          <span className="flex items-center gap-1.5 text-sm text-[rgb(var(--danger))]">
            <AlertCircle className="w-4 h-4" /> Save failed — please try again
          </span>
        )}
        {!saveResult && <span />}

        <Button type="submit" size="md" disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save configuration
        </Button>
      </div>
    </form>
  );
}
