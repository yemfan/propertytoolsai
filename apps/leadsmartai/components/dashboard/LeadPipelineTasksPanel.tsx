"use client";

import { useCallback, useEffect, useState } from "react";

type Stage = {
  id: string;
  name: string;
  slug: string;
  position: number;
  color: string | null;
};

type CrmTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  source: string;
};

type AiPlan = {
  summary: string;
  recommendedStageSlug: string | null;
  tasks: Array<{
    title: string;
    description?: string | null;
    dueInDays?: number | null;
    priority: string;
  }>;
};

export default function LeadPipelineTasksPanel({
  leadId,
  pipelineStageId,
  onStageChange,
  leadPhone,
  leadEmail,
}: {
  leadId: string;
  pipelineStageId?: string | null;
  onStageChange?: (stageId: string | null) => void;
  leadPhone?: string | null;
  leadEmail?: string | null;
}) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [stageSaving, setStageSaving] = useState(false);
  const [plan, setPlan] = useState<AiPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [ctx, setCtx] = useState("");

  const reload = useCallback(async () => {
    setErr(null);
    try {
      const [sRes, tRes] = await Promise.all([
        fetch("/api/dashboard/pipeline/stages", { credentials: "include" }),
        fetch(`/api/dashboard/tasks?leadId=${encodeURIComponent(leadId)}&status=all`, {
          credentials: "include",
        }),
      ]);
      const sJson = (await sRes.json().catch(() => ({}))) as any;
      const tJson = (await tRes.json().catch(() => ({}))) as any;
      if (!sRes.ok || !sJson?.ok) throw new Error(sJson?.error ?? "Could not load pipeline.");
      if (!tRes.ok || !tJson?.ok) throw new Error(tJson?.error ?? "Could not load tasks.");
      setStages(sJson.stages ?? []);
      setTasks(tJson.tasks ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Load failed.");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  async function saveStage(nextId: string) {
    setStageSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/dashboard/leads/${encodeURIComponent(leadId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pipeline_stage_id: nextId === "" ? null : nextId,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || json?.error) throw new Error(json?.error ?? "Could not update stage.");
      onStageChange?.(nextId === "" ? null : nextId);
    } catch (e: any) {
      setErr(e?.message ?? "Stage update failed.");
    } finally {
      setStageSaving(false);
    }
  }

  async function addTask() {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    setErr(null);
    try {
      const res = await fetch("/api/dashboard/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          leadId,
          pipelineStageId: pipelineStageId ?? null,
          title,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Could not add task.");
      setNewTitle("");
      await reload();
    } catch (e: any) {
      setErr(e?.message ?? "Add task failed.");
    } finally {
      setAdding(false);
    }
  }

  async function setTaskStatus(taskId: string, status: "open" | "done") {
    setErr(null);
    try {
      const res = await fetch(`/api/dashboard/tasks/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Could not update task.");
      await reload();
    } catch (e: any) {
      setErr(e?.message ?? "Update failed.");
    }
  }

  async function suggestPlan() {
    setPlanLoading(true);
    setErr(null);
    setPlan(null);
    try {
      const res = await fetch(`/api/dashboard/leads/${encodeURIComponent(leadId)}/ai-pipeline-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ context: ctx.trim() || undefined }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "AI plan failed.");
      setPlan(json.plan as AiPlan);
    } catch (e: any) {
      setErr(e?.message ?? "AI plan failed.");
    } finally {
      setPlanLoading(false);
    }
  }

  async function applyPlan() {
    if (!plan) return;
    setApplyLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/dashboard/leads/${encodeURIComponent(leadId)}/ai-pipeline-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ apply: true, plan }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Apply failed.");
      setPlan(null);
      setCtx("");
      await reload();
      if (json.plan?.recommendedStageSlug) {
        const st = stages.find((s) => s.slug === json.plan.recommendedStageSlug);
        if (st) onStageChange?.(st.id);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Apply failed.");
    } finally {
      setApplyLoading(false);
    }
  }

  const openTasks = tasks.filter((t) => t.status === "open");

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deal pipeline & tasks</div>

      {err ? (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5">{err}</p>
      ) : null}

      {loading ? (
        <p className="text-xs text-slate-600">Loading pipeline…</p>
      ) : (
        <>
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Stage</span>
            <select
              className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white"
              value={pipelineStageId ?? ""}
              disabled={stageSaving}
              onChange={(e) => void saveStage(e.target.value)}
            >
              <option value="">— Not set —</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          {/* Quick contact actions */}
          <div className="flex gap-2">
            {leadPhone && (
              <a href={`tel:${leadPhone.replace(/\D/g, "")}`} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">
                <span>📞</span> Call
              </a>
            )}
            {leadPhone && (
              <a href={`sms:${leadPhone.replace(/\D/g, "")}`} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                <span>💬</span> SMS
              </a>
            )}
            {leadEmail && (
              <a href={`mailto:${leadEmail}`} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
                <span>✉️</span> Email
              </a>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700">Open tasks ({openTasks.length})</div>
            <ul className="space-y-1.5 max-h-40 overflow-y-auto">
              {openTasks.length === 0 ? (
                <li className="text-xs text-slate-500">No open tasks.</li>
              ) : (
                openTasks.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-start justify-between gap-2 text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5"
                  >
                    <span className="text-slate-800 min-w-0">{t.title}</span>
                    <button
                      type="button"
                      onClick={() => void setTaskStatus(t.id, "done")}
                      className="shrink-0 text-blue-600 font-semibold hover:underline"
                    >
                      Done
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="flex gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="New task…"
              className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") void addTask();
              }}
            />
            <button
              type="button"
              disabled={adding || !newTitle.trim()}
              onClick={() => void addTask()}
              className="rounded-xl bg-slate-900 text-white text-xs font-semibold px-3 py-2 disabled:opacity-50"
            >
              Add
            </button>
          </div>

          <div className="border-t border-slate-200 pt-3 space-y-2">
            <div className="text-xs font-semibold text-slate-700">AI next steps</div>
            <textarea
              value={ctx}
              onChange={(e) => setCtx(e.target.value)}
              placeholder="Optional context for the planner (e.g. “Wants waterfront under $900k”)."
              rows={2}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={planLoading}
                onClick={() => void suggestPlan()}
                className="rounded-xl bg-violet-600 text-white text-xs font-semibold px-3 py-2 disabled:opacity-50"
              >
                {planLoading ? "Planning…" : "Suggest plan"}
              </button>
              {plan ? (
                <button
                  type="button"
                  disabled={applyLoading}
                  onClick={() => void applyPlan()}
                  className="rounded-xl bg-emerald-600 text-white text-xs font-semibold px-3 py-2 disabled:opacity-50"
                >
                  {applyLoading ? "Applying…" : "Apply plan"}
                </button>
              ) : null}
            </div>
            {plan ? (
              <div className="text-xs text-slate-700 space-y-2 bg-white border border-slate-200 rounded-lg p-2">
                <p className="font-medium text-slate-900">{plan.summary}</p>
                {plan.recommendedStageSlug ? (
                  <p className="text-slate-600">
                    Suggested stage:{" "}
                    <span className="font-semibold">
                      {stages.find((s) => s.slug === plan.recommendedStageSlug)?.name ?? plan.recommendedStageSlug}
                    </span>
                  </p>
                ) : null}
                <ul className="list-disc pl-4 space-y-0.5">
                  {plan.tasks.map((t, i) => (
                    <li key={i}>
                      {t.title}
                      {t.dueInDays != null ? ` (due in ${t.dueInDays}d)` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
