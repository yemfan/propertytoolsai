"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Check, X, CalendarClock, Pencil } from "lucide-react";

/**
 * Unified task shape merging crm_tasks (manual + briefing) with
 * playbook_task_instances (per-anchor batches + coaching). The id
 * is namespaced ("crm:<uuid>" / "pb:<uuid>") so writes can route
 * back to the right backend.
 */
type UnifiedSource = "manual" | "briefing" | "playbook" | "coaching";

type TaskRow = {
  id: string;
  source: UnifiedSource;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  completed_at: string | null;
  contact_id: string | null;
  contact_name: string | null;
  /** Populated only for source="playbook"|"coaching". */
  playbook?: {
    templateKey: string;
    title: string;
    section: string | null;
    batchId: string | null;
    anchorKind: "transaction" | "open_house" | "contact" | "generic";
    anchorId: string | null;
  };
};

type LeadInfo = { id: string; name: string | null };
type ChartItem = { name: string; value: number; color: string };
type DayItem = { date: string; label: string; count: number };
type Stats = { completion: ChartItem[]; performedByDay: DayItem[]; performed: number; total: number };

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-amber-100 text-amber-700",
  normal: "bg-blue-100 text-blue-700",
  low: "bg-gray-100 text-gray-600",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
};

function timeLabel(iso: string | null) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  const now = Date.now();
  const diff = d.getTime() - now;
  const days = Math.floor(diff / 86_400_000);
  if (days < -1) return `${Math.abs(days)}d overdue`;
  if (days === -1) return "Yesterday";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days}d`;
}

function MiniPie({ data, title }: { data: ChartItem[]; title: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-semibold text-gray-500 mb-2">{title}</h3>
      <div className="flex items-center gap-3">
        <div className="h-[120px] w-[120px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={50} innerRadius={28} strokeWidth={1}>
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => v} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1 text-xs">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-gray-600">{d.name}</span>
              <span className="font-semibold text-gray-900">{d.value}</span>
              {total > 0 && <span className="text-gray-400">({Math.round((d.value / total) * 100)}%)</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TasksClient({
  leads,
}: {
  leads: LeadInfo[];
}) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statusFilter, setStatusFilter] = useState("open");
  const [sourceFilter, setSourceFilter] = useState<UnifiedSource | "all">("all");
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFields, setAddFields] = useState({ title: "", description: "", priority: "normal", due_at: "", contact_id: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Partial<TaskRow>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const leadMap = new Map(leads.map((l) => [l.id, l.name ?? `Lead #${l.id}`]));

  /**
   * Fetch the unified task list. Re-runs whenever the status tab
   * changes — server-side filtering is cheaper than fetching All
   * and filtering client-side, especially once an agent has
   * hundreds of completed tasks across both backends.
   */
  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const res = await fetch(`/api/dashboard/tasks/unified?status=${encodeURIComponent(statusFilter)}`);
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        tasks?: TaskRow[];
      };
      if (body.ok && Array.isArray(body.tasks)) setTasks(body.tasks);
    } catch {
      /* silent — error banner not worth rendering for read failures */
    } finally {
      setTasksLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/tasks/stats");
      const body = await res.json().catch(() => ({}));
      if (body.ok) setStats(body);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  async function addTask() {
    if (!addFields.title.trim()) return;
    setActionLoading(true); setActionMsg(null);
    try {
      const res = await fetch("/api/dashboard/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addFields.title,
          description: addFields.description || null,
          priority: addFields.priority,
          dueAt: addFields.due_at || null,
          leadId: addFields.contact_id || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Failed");
      setAddFields({ title: "", description: "", priority: "normal", due_at: "", contact_id: "" });
      setShowAddForm(false);
      setActionMsg("Task added.");
      window.location.reload();
    } catch (e) { setActionMsg(e instanceof Error ? e.message : "Error"); }
    finally { setActionLoading(false); }
  }

  /**
   * Routes the patch to the correct backend based on the task's
   * namespaced id prefix:
   *   - "crm:<uuid>" → PATCH /api/dashboard/tasks
   *   - "pb:<uuid>"  → PATCH /api/dashboard/playbooks/[taskId] (via
   *                    `completed: boolean` body, the only mutation
   *                    the playbook endpoint currently supports)
   *
   * Phase 2 lands richer playbook mutations (cancel/snooze/edit)
   * — for now playbook tasks only support marking complete.
   */
  async function updateTask(id: string, patch: Record<string, unknown>) {
    setActionLoading(true); setActionMsg(null);
    try {
      if (id.startsWith("pb:")) {
        const rawId = id.slice(3);
        // Playbook backend only supports a completion toggle today.
        // Map "status" patches to the toggle; reject other mutations.
        if (patch.status === "done" || patch.status === "open") {
          const res = await fetch(`/api/dashboard/playbooks/${rawId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ completed: patch.status === "done" }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok || !body.ok) throw new Error(body.error ?? "Update failed");
          setTasks((prev) =>
            prev.map((t) =>
              t.id === id
                ? {
                    ...t,
                    status: patch.status === "done" ? "done" : "open",
                    completed_at: patch.status === "done" ? new Date().toISOString() : null,
                  }
                : t,
            ),
          );
          setEditingId(null);
          setActionMsg("Updated.");
          loadStats();
          return;
        }
        setActionMsg(
          "Cancel / snooze / edit on playbook tasks is coming in the next update — open the playbook view to edit there.",
        );
        return;
      }
      const rawId = id.startsWith("crm:") ? id.slice(4) : id;
      const res = await fetch("/api/dashboard/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: rawId, ...patch }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Update failed");
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? ({ ...t, ...patch, status: String(patch.status ?? t.status) } as TaskRow) : t,
        ),
      );
      setEditingId(null);
      setActionMsg("Updated.");
      loadStats();
    } catch (e) { setActionMsg(e instanceof Error ? e.message : "Error"); }
    finally { setActionLoading(false); }
  }

  async function markDone(id: string) {
    await updateTask(id, { status: "done" });
  }

  async function markCancelled(id: string) {
    await updateTask(id, { status: "cancelled" });
  }

  /**
   * "Move to" / snooze — push the due date out by `days` (tomorrow,
   * next week). Keeps status open so the task stays on the user's
   * radar; just out of today's view.
   */
  async function snoozeBy(id: string, days: number) {
    const target = new Date();
    target.setDate(target.getDate() + days);
    target.setHours(9, 0, 0, 0);
    await updateTask(id, { dueAt: target.toISOString() });
  }

  function startEdit(task: TaskRow) {
    setEditingId(task.id);
    setEditFields({ title: task.title, description: task.description, priority: task.priority, status: task.status, due_at: task.due_at });
  }

  /**
   * Status filter is applied server-side (re-fetch on tab change),
   * but source + search are client-side because the unified payload
   * is bounded (~250 rows from each backend) and instant filtering
   * feels better than another round-trip.
   */
  const filtered = tasks.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (sourceFilter !== "all" && t.source !== sourceFilter) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return t.title.toLowerCase().includes(s) || (t.description ?? "").toLowerCase().includes(s);
  });

  /** Counts for the source-chip badges. Computed pre-source-filter
   *  so users see how many of each kind exist regardless of which
   *  chip is currently active. */
  const sourceCounts = useMemo(() => {
    const out = { all: tasks.length, manual: 0, briefing: 0, playbook: 0, coaching: 0 };
    for (const t of tasks) out[t.source] += 1;
    return out;
  }, [tasks]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500">{tasks.filter((t) => t.status === "open").length} open tasks</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-3 md:grid-cols-2">
          <MiniPie data={stats.completion} title="Task Completion (30 days)" />
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 mb-2">Tasks Completed by Day (30 days) &mdash; {stats.performed} total</h3>
            <div className="h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.performedByDay} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 8 }} stroke="#9ca3af" interval={4} />
                  <YAxis tick={{ fontSize: 9 }} stroke="#9ca3af" allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [v, "Completed"]} />
                  <Bar dataKey="count" fill="#22c55e" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons + messages */}
      {actionMsg && <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">{actionMsg}</div>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setShowAddForm((v) => !v)}
          className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800">
          {showAddForm ? "Cancel" : "Add Task"}
        </button>
      </div>

      {/* Add task form */}
      {showAddForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">New Task</h3>
          <input value={addFields.title} onChange={(e) => setAddFields((f) => ({ ...f, title: e.target.value }))} placeholder="Task title *" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <div className="grid gap-3 sm:grid-cols-3">
            <select value={addFields.priority} onChange={(e) => setAddFields((f) => ({ ...f, priority: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <input type="datetime-local" value={addFields.due_at} onChange={(e) => setAddFields((f) => ({ ...f, due_at: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <select value={addFields.contact_id} onChange={(e) => setAddFields((f) => ({ ...f, contact_id: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">No contact</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.name ?? `Lead #${l.id}`}</option>)}
            </select>
          </div>
          <textarea value={addFields.description} onChange={(e) => setAddFields((f) => ({ ...f, description: e.target.value }))} placeholder="Notes / description" rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <button type="button" onClick={() => void addTask()} disabled={actionLoading || !addFields.title.trim()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
            {actionLoading ? "Saving..." : "Create Task"}
          </button>
        </div>
      )}

      {/* Status tabs — clickable counts replace the old select.
          Always show all four so the agent can see at a glance how
          much of each bucket exists. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200">
        {([
          { key: "open", label: "Open" },
          { key: "done", label: "Completed" },
          { key: "cancelled", label: "Cancelled" },
          { key: "all", label: "All" },
        ] as const).map((tab) => {
          const count =
            tab.key === "all"
              ? tasks.length
              : tasks.filter((t) => t.status === tab.key).length;
          const active = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
                active
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                  active ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Source filter chips — applies on top of the status tab.
          All four chips render even when their count is 0 so the
          set is predictable; clicking the active chip re-toggles
          to "All". */}
      <div className="flex flex-wrap items-center gap-1.5">
        {([
          { key: "all", label: "All sources", emoji: null },
          { key: "manual", label: "Manual", emoji: "✋" },
          { key: "briefing", label: "Briefing", emoji: "☀️" },
          { key: "playbook", label: "Playbook", emoji: "📋" },
          { key: "coaching", label: "Coaching", emoji: "🎯" },
        ] as const).map((chip) => {
          const count = sourceCounts[chip.key];
          const active = sourceFilter === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => setSourceFilter(active && chip.key !== "all" ? "all" : chip.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                active
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              {chip.emoji ? <span aria-hidden>{chip.emoji}</span> : null}
              {chip.label}
              <span className="rounded-full bg-white/70 px-1 text-[10px] tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks..."
          className="flex-1 min-w-[200px] max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </div>

      {/* Tasks table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Task</th>
                <th className="text-left px-4 py-2.5 font-medium">Contact</th>
                <th className="text-left px-4 py-2.5 font-medium">Due</th>
                <th className="text-left px-4 py-2.5 font-medium">Priority</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Memo</th>
                <th className="text-left px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((t) => {
                const isEditing = editingId === t.id;
                if (isEditing) {
                  return (
                    <tr key={t.id} className="bg-blue-50/30">
                      <td className="px-4 py-2"><input value={editFields.title ?? ""} onChange={(e) => setEditFields((f) => ({ ...f, title: e.target.value }))} className="w-full rounded border border-gray-300 px-2 py-1 text-sm" /></td>
                      <td className="px-4 py-2 text-xs text-gray-500">{t.contact_id ? leadMap.get(String(t.contact_id)) ?? t.contact_id : "\u2014"}</td>
                      <td className="px-4 py-2"><input type="datetime-local" value={editFields.due_at ? new Date(editFields.due_at).toISOString().slice(0, 16) : ""} onChange={(e) => setEditFields((f) => ({ ...f, due_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} className="rounded border border-gray-300 px-2 py-1 text-sm" /></td>
                      <td className="px-4 py-2">
                        <select value={editFields.priority ?? "normal"} onChange={(e) => setEditFields((f) => ({ ...f, priority: e.target.value }))} className="rounded border border-gray-300 px-2 py-1 text-sm">
                          <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <select value={editFields.status ?? t.status} onChange={(e) => setEditFields((f) => ({ ...f, status: e.target.value }))} className="rounded border border-gray-300 px-2 py-1 text-sm">
                          <option value="open">Open</option><option value="done">Done</option><option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="px-4 py-2"><input value={editFields.description ?? ""} onChange={(e) => setEditFields((f) => ({ ...f, description: e.target.value }))} className="w-full rounded border border-gray-300 px-2 py-1 text-sm" placeholder="Notes" /></td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <button onClick={() => void updateTask(t.id, { title: editFields.title, description: editFields.description, priority: editFields.priority, status: editFields.status, dueAt: editFields.due_at })} disabled={actionLoading} className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 mr-2">Save</button>
                        <button onClick={() => setEditingId(null)} className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                      </td>
                    </tr>
                  );
                }
                const isPlaybookRow = t.source === "playbook" || t.source === "coaching";
                return (
                  <tr key={t.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-gray-900">{t.title}</span>
                        <SourceChip task={t} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">
                      {t.contact_name ? t.contact_name : t.contact_id ? leadMap.get(String(t.contact_id)) ?? `#${t.contact_id}` : "\u2014"}
                    </td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                      {t.due_at ? (
                        <span className={t.status === "open" && t.due_at && new Date(t.due_at).getTime() < Date.now() ? "text-red-600 font-medium" : "text-gray-600"}>
                          {timeLabel(t.due_at)}
                        </span>
                      ) : "\u2014"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_COLORS[t.priority] ?? ""}`}>{t.priority}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[t.status] ?? ""}`}>{t.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[200px] truncate">{t.description ?? "\u2014"}</td>
                    {/* Row actions \u2014 compact icon buttons. Complete /
                        cancel / move-to (snooze) only render when the
                        task is still open; Edit is always available. */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="inline-flex items-center gap-0.5">
                        {t.status === "open" && (
                          <TaskIconButton
                            onClick={() => void markDone(t.id)}
                            disabled={actionLoading}
                            title="Mark complete"
                            ariaLabel="Mark complete"
                            tone="success"
                          >
                            <Check className="h-4 w-4" strokeWidth={2.5} />
                          </TaskIconButton>
                        )}
                        {/* Cancel / snooze / edit are CRM-only in Phase 1.
                            Playbook tasks land richer mutations in Phase 2;
                            for now they show a "manage in playbook view"
                            link instead. */}
                        {!isPlaybookRow && t.status === "open" && (
                          <>
                            <TaskIconButton
                              onClick={() => void markCancelled(t.id)}
                              disabled={actionLoading}
                              title="Cancel task"
                              ariaLabel="Cancel task"
                              tone="danger"
                            >
                              <X className="h-4 w-4" strokeWidth={2.5} />
                            </TaskIconButton>
                            <SnoozeMenu
                              disabled={actionLoading}
                              onSnooze={(days) => void snoozeBy(t.id, days)}
                            />
                          </>
                        )}
                        {!isPlaybookRow ? (
                          <TaskIconButton
                            onClick={() => startEdit(t)}
                            title="Edit task"
                            ariaLabel="Edit task"
                          >
                            <Pencil className="h-4 w-4" strokeWidth={2} />
                          </TaskIconButton>
                        ) : (
                          <Link
                            href="/dashboard/playbooks"
                            className="text-[10px] font-medium text-gray-400 hover:text-gray-700 hover:underline px-1.5"
                            title="Manage from playbook view"
                          >
                            Manage →
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    {search ? "No tasks match your search." : statusFilter === "open" ? "No open tasks." : "No tasks."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * Per-row source chip — a small subtitle under the task title that
 * tells the agent where this task came from. For playbook +
 * coaching rows it also names the playbook + section so they can
 * recognize a batch without leaving the page. Manual tasks render
 * nothing (the absence of a chip = "I made this myself").
 */
function SourceChip({ task }: { task: TaskRow }) {
  if (task.source === "manual") return null;
  if (task.source === "briefing") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700">
        <span aria-hidden>☀️</span>
        Morning briefing
      </span>
    );
  }
  // Playbook + coaching share the same shape (template title + section).
  const title = task.playbook?.title ?? task.source;
  const section = task.playbook?.section;
  const tone =
    task.source === "coaching"
      ? "text-emerald-700"
      : "text-indigo-700";
  const emoji = task.source === "coaching" ? "🎯" : "📋";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${tone}`}>
      <span aria-hidden>{emoji}</span>
      {title}
      {section ? <span className="text-gray-400">· {section}</span> : null}
    </span>
  );
}

/**
 * Compact icon-only button used for the row-level actions on the
 * tasks table. Tone variants paint the icon for affirmative
 * (success / green) or destructive (danger / red) actions; default
 * tone is neutral gray.
 */
function TaskIconButton({
  children,
  onClick,
  title,
  ariaLabel,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  ariaLabel: string;
  disabled?: boolean;
  tone?: "success" | "danger";
}) {
  const toneClasses =
    tone === "success"
      ? "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
      : tone === "danger"
        ? "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition disabled:opacity-40 ${toneClasses}`}
    >
      {children}
    </button>
  );
}

/**
 * "Move to" / snooze menu — opens a small popover with quick
 * presets that bump the due date forward without forcing the user
 * into the full edit flow. Click-away closes.
 */
function SnoozeMenu({
  disabled,
  onSnooze,
}: {
  disabled?: boolean;
  onSnooze: (days: number) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onAway = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-snooze-menu]")) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onAway);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onAway);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const presets: Array<{ label: string; days: number }> = [
    { label: "Tomorrow", days: 1 },
    { label: "In 3 days", days: 3 },
    { label: "Next week", days: 7 },
  ];

  return (
    <div className="relative inline-block" data-snooze-menu>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title="Move to a later date"
        aria-label="Move task to a later date"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-amber-600 transition hover:bg-amber-50 hover:text-amber-700 disabled:opacity-40"
      >
        <CalendarClock className="h-4 w-4" strokeWidth={2} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-36 origin-top-right overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg ring-1 ring-black/5"
        >
          {presets.map((p) => (
            <button
              key={p.days}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSnooze(p.days);
              }}
              className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              {p.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
