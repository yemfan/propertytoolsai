"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Template = { key: string; title: string; description: string };
type Step = {
  id: string;
  step_order: number;
  channel: string;
  action: string;
  subject: string | null;
  body: string;
  delay_days: number;
  enabled: boolean;
  status: string;
  executed_at: string | null;
};
type Plan = {
  id: string;
  title: string;
  status: string;
  template_key: string;
  lead_id: string | null;
  created_at: string;
  steps?: Step[];
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  approved: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  paused: "bg-amber-100 text-amber-800",
  completed: "bg-slate-200 text-slate-600",
  cancelled: "bg-red-100 text-red-700",
};

const CHANNEL_LABELS: Record<string, string> = {
  sms: "SMS",
  email: "Email",
  task: "Task",
  notification: "Alert",
};

export default function MarketingPlansClient() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [leadId, setLeadId] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/marketing-plans");
      const body = await res.json().catch(() => ({}));
      if (body.ok) {
        setPlans(body.plans ?? []);
        setTemplates(body.templates ?? []);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  async function createPlan() {
    if (!leadId || !templateKey) return;
    setCreating(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/dashboard/marketing-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, templateKey }),
      });
      const body = await res.json().catch(() => ({}));
      if (body.ok) {
        setFeedback("Plan created! Review and approve it to start.");
        setLeadId("");
        setTemplateKey("");
        fetchPlans();
        if (body.plan) setSelectedPlan(body.plan);
      } else {
        setFeedback(body.error ?? "Failed to create plan.");
      }
    } catch { setFeedback("Network error."); } finally { setCreating(false); }
  }

  async function loadPlanDetail(planId: string) {
    try {
      const res = await fetch(`/api/dashboard/marketing-plans/${planId}`);
      const body = await res.json().catch(() => ({}));
      if (body.ok) setSelectedPlan(body.plan);
    } catch { /* silent */ }
  }

  async function planAction(planId: string, action: string) {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/dashboard/marketing-plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await res.json().catch(() => ({}));
      if (body.ok) {
        fetchPlans();
        loadPlanDetail(planId);
      } else {
        setFeedback(body.error ?? "Action failed.");
      }
    } catch { setFeedback("Network error."); } finally { setActionLoading(null); }
  }

  async function toggleStep(planId: string, stepId: string, enabled: boolean) {
    await fetch(`/api/dashboard/marketing-plans/${planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId, stepPatch: { enabled } }),
    });
    loadPlanDetail(planId);
  }

  if (loading) return <div className="py-20 text-center text-gray-400">Loading...</div>;

  // Plan detail view
  if (selectedPlan) {
    const p = selectedPlan;
    return (
      <div className="space-y-6">
        <button onClick={() => setSelectedPlan(null)} className="text-sm text-gray-600 hover:text-gray-900">
          &larr; Back to plans
        </button>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{p.title}</h2>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] ?? ""}`}>
                {p.status}
              </span>
            </div>
            <div className="flex gap-2">
              {p.status === "draft" && (
                <button disabled={!!actionLoading} onClick={() => planAction(p.id, "approve")} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {actionLoading === "approve" ? "..." : "Approve"}
                </button>
              )}
              {p.status === "approved" && (
                <button disabled={!!actionLoading} onClick={() => planAction(p.id, "start")} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                  {actionLoading === "start" ? "..." : "Start Execution"}
                </button>
              )}
              {p.status === "active" && (
                <button disabled={!!actionLoading} onClick={() => planAction(p.id, "pause")} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  Pause
                </button>
              )}
              {["draft", "approved", "active", "paused"].includes(p.status) && (
                <button disabled={!!actionLoading} onClick={() => planAction(p.id, "cancel")} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Plan Steps</h3>
          {(p.steps ?? []).map((step) => (
            <div
              key={step.id}
              className={`rounded-xl border p-4 ${!step.enabled ? "border-gray-100 bg-gray-50 opacity-60" : "border-gray-200 bg-white"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={step.enabled}
                      onChange={(e) => toggleStep(p.id, step.id, e.target.checked)}
                      disabled={p.status !== "draft"}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </label>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        Day {step.delay_days}
                      </span>
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {CHANNEL_LABELS[step.channel] ?? step.channel}
                      </span>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                        step.status === "executed" ? "bg-green-50 text-green-700" :
                        step.status === "failed" ? "bg-red-50 text-red-700" :
                        "bg-gray-50 text-gray-500"
                      }`}>
                        {step.status}
                      </span>
                    </div>
                    {step.subject && <p className="mt-1 text-sm font-medium text-gray-900">{step.subject}</p>}
                    <p className="mt-0.5 text-sm text-gray-600 line-clamp-2">{step.body}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Plans list view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Marketing Plans</h1>
        <p className="text-sm text-gray-500">Create automated marketing sequences for your leads.</p>
      </div>

      {feedback && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-sm text-blue-800">{feedback}</div>
      )}

      {/* Create new plan */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Create a new plan</h3>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={leadId}
            onChange={(e) => setLeadId(e.target.value)}
            placeholder="Lead ID"
            className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={templateKey}
            onChange={(e) => setTemplateKey(e.target.value)}
            className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select template...</option>
            {templates.map((t) => (
              <option key={t.key} value={t.key}>{t.title}</option>
            ))}
          </select>
          <button
            disabled={!leadId || !templateKey || creating}
            onClick={() => void createPlan()}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Generate Plan"}
          </button>
        </div>
        {templateKey && templates.find((t) => t.key === templateKey) && (
          <p className="text-xs text-gray-500">
            {templates.find((t) => t.key === templateKey)?.description}
          </p>
        )}
      </div>

      {/* Plans list */}
      {plans.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-gray-500">No marketing plans yet.</p>
          <p className="mt-1 text-sm text-gray-400">Create one above to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => loadPlanDetail(p.id)}
              className="w-full text-left rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm hover:bg-gray-50"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.title}</p>
                  <p className="text-xs text-gray-500">
                    {p.template_key} &middot; {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] ?? ""}`}>
                  {p.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
