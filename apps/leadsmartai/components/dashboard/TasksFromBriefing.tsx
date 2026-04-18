"use client";

import { useEffect, useState } from "react";

type Task = {
  id: string;
  contact_id: number | null;
  title: string;
  description: string | null;
  type: string;
  status: string;
  due_date: string;
  deferred_until: string | null;
};

function addDays(base: string, days: number) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function TasksFromBriefing() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/tasks?status=pending", { credentials: "include" });
        const json = (await res.json().catch(() => ({}))) as any;
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error ?? "Failed to load tasks.");
        }
        if (!cancelled) {
          setTasks((json.tasks ?? []) as Task[]);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Error loading tasks.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function updateTask(id: string, action: "done" | "skip" | "defer", days?: number) {
    try {
      const body: any = { action };
      if (action === "defer") {
        const today = new Date().toISOString().slice(0, 10);
        body.deferred_until = addDays(today, days ?? 1);
      }
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error ?? "Failed to update task.");
      }
      const updated: Task | undefined = json.task;
      if (updated) {
        setTasks((prev) => prev.filter((t) => t.id !== updated.id));
      }
    } catch (e: any) {
      alert(e?.message ?? "Error updating task.");
    }
  }

  if (loading) {
    return <p className="text-xs text-slate-500">Loading tasks…</p>;
  }

  if (error) {
    return <p className="text-xs text-red-600">{error}</p>;
  }

  if (!tasks.length) {
    return <p className="text-xs text-slate-500">No pending tasks from today&apos;s briefing.</p>;
  }

  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <div
          key={t.id}
          className="border border-slate-100 rounded-lg px-3 py-2 text-xs flex flex-col gap-1"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-slate-800">{t.title}</div>
            <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
              {t.type}
            </span>
          </div>
          {t.description ? (
            <div className="text-slate-600 line-clamp-2">{t.description}</div>
          ) : null}
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="text-[10px] text-slate-500">
              Due {t.due_date}
              {t.contact_id ? ` • Lead #${t.contact_id}` : ""}
            </span>
            <div className="flex gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => updateTask(t.id, "done")}
                className="px-2 py-1 rounded-md bg-emerald-600 text-white text-[11px] font-semibold"
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => updateTask(t.id, "skip")}
                className="px-2 py-1 rounded-md bg-slate-200 text-slate-800 text-[11px] font-semibold"
              >
                Skip
              </button>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => updateTask(t.id, "defer", 1)}
                  className="px-2 py-1 rounded-md bg-white border border-slate-200 text-[10px]"
                >
                  +1 day
                </button>
                <button
                  type="button"
                  onClick={() => updateTask(t.id, "defer", 3)}
                  className="px-2 py-1 rounded-md bg-white border border-slate-200 text-[10px]"
                >
                  +3 days
                </button>
                <button
                  type="button"
                  onClick={() => updateTask(t.id, "defer", 7)}
                  className="px-2 py-1 rounded-md bg-white border border-slate-200 text-[10px]"
                >
                  +7 days
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

