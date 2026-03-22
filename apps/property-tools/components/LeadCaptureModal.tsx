"use client";

import { useCallback, useEffect, useState } from "react";
import { createLead, type CreateLeadInput } from "@/lib/leads";
import { trackEvent } from "@/lib/tracking";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type LeadCaptureModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "home_value" */
  source: string;
  tool?: string;
  intent?: "buy" | "sell" | "refinance";
  propertyAddress?: string;
  /** Client funnel id (home value session) */
  sessionId?: string;
  /** Parsed geo for CRM columns */
  geo?: { city?: string | null; state?: string | null; zip?: string | null };
  /** Override `full_address` column (defaults to `propertyAddress`) */
  fullAddress?: string;
  onSuccess?: (payload: { leadId?: string }) => void;
  /** Override default headline / CTA (e.g. Expert CTA) */
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  /** Extra CRM fields (home value, confidence, engagement metadata for LeadSmart) */
  leadExtras?: Pick<
    CreateLeadInput,
    "property_value" | "confidence_score" | "engagement_score" | "metadata"
  >;
  /** When set, replaces default `createLead` (e.g. expert-capture + matching) */
  customSubmit?: (payload: {
    name: string;
    email: string;
    phone: string;
  }) => Promise<{
    ok: boolean;
    error?: string;
    leadId?: string;
    matched_agent_ids?: string[];
  }>;
};

export default function LeadCaptureModal({
  open,
  onOpenChange,
  source,
  tool = "home_value",
  intent = "sell",
  propertyAddress = "",
  sessionId,
  geo,
  fullAddress,
  onSuccess,
  title = "Unlock full report",
  subtitle = "Get the detailed breakdown, range context, and next steps — free.",
  submitLabel = "Unlock Full Report",
  leadExtras,
  customSubmit,
}: LeadCaptureModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setName("");
    setEmail("");
    setPhone("");
    setSubmitting(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    void trackEvent("lead_capture_opened", { source, tool, intent });
  }, [open, source, tool, intent, reset]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = name.trim();
    const em = email.trim().toLowerCase();
    if (!n) {
      setError("Please enter your name.");
      return;
    }
    if (!em || !EMAIL_RE.test(em)) {
      setError("Please enter a valid email.");
      return;
    }

    setSubmitting(true);
    try {
      const result = customSubmit
        ? await customSubmit({ name: n, email: em, phone: phone.trim() })
        : await (() => {
            const meta =
              leadExtras?.metadata != null && typeof leadExtras.metadata === "object"
                ? (leadExtras.metadata as Record<string, unknown>)
                : null;
            const parseOptNum = (k: string) => {
              if (!meta || !(k in meta)) return undefined;
              const v = Number(meta[k]);
              return Number.isFinite(v) ? v : undefined;
            };
            return createLead({
            name: n,
            email: em,
            phone: phone.trim() || undefined,
            source,
            intent,
            property_address: propertyAddress.trim() || undefined,
            tool,
            ...leadExtras,
            session_id: sessionId,
            full_address: fullAddress?.trim() || propertyAddress.trim() || undefined,
            city: geo?.city ?? undefined,
            state: geo?.state ?? undefined,
            zip: geo?.zip ?? undefined,
            estimate_low: parseOptNum("estimate_low"),
            estimate_high: parseOptNum("estimate_high"),
            confidence:
              meta && "confidence_level" in meta && meta.confidence_level != null
                ? String(meta.confidence_level)
                : undefined,
            likely_intent:
              meta && "likely_intent" in meta && meta.likely_intent != null
                ? String(meta.likely_intent)
                : undefined,
            engagement_score:
              leadExtras?.engagement_score != null
                ? Math.min(
                    100,
                    Math.round(Number(leadExtras.engagement_score)) + (phone.trim() ? 3 : 0)
                  )
                : undefined,
          });
          })();

      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }

      const matchedIds: string[] | undefined =
        customSubmit && "matched_agent_ids" in result && Array.isArray((result as { matched_agent_ids?: unknown }).matched_agent_ids)
          ? ((result as { matched_agent_ids: string[] }).matched_agent_ids)
          : undefined;

      await trackEvent(customSubmit ? "lead_created" : "lead_submitted", {
        source,
        tool,
        intent,
        lead_id: result.leadId,
      });

      if (matchedIds && matchedIds.length > 0) {
        await trackEvent("agent_matched", {
          source,
          tool,
          lead_id: result.leadId,
          matched_agent_ids: matchedIds,
          count: matchedIds.length,
        });
      }

      onSuccess?.({ leadId: result.leadId });
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-capture-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/10">
            <h2
              id="lead-capture-title"
              className="text-lg font-bold tracking-tight text-slate-900"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{subtitle}</p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Name
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Jane Homeowner"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="you@email.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="(555) 555-5555"
                  autoComplete="tel"
                />
              </div>

              {error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
              ) : null}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => onOpenChange(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting ? "Saving…" : submitLabel}
                </button>
              </div>
            </form>
      </div>
    </div>
  );
}
