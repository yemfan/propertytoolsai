"use client";

import { useCallback, useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  completed_at: string | null;
  source: string;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
};

type LeadInfo = { id: string; name: string | null };
type ChartItem = { name: string; value: number; color: string };
type Stats = { completion: ChartItem[]; performed: number; total: number };

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
  tasks: initialTasks,
  leads,
}: {
  tasks: TaskRow[];
  leads: LeadInfo[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statusFilter, setStatusFilter] = useState("open");
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFields, setAddFields] = useState({ title: "", description: "", priority: "normal", due_at: "", lead_id: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Partial<TaskRow>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const leadMap = new Map(leads.map((l) => [l.id, l.name ?? `Lead #${l.id}`]));

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
          leadId: addFields.lead_id || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Failed");
      setAddFields({ title: "", description: "", priority: "normal", due_at: "", lead_id: "" });
      setShowAddForm(false);
      setActionMsg("Task added.");
      window.location.reload();
    } catch (e) { setActionMsg(e instanceof Error ? e.message : "Error"); }
    finally { setActionLoading(false); }
  }

  async function updateTask(id: string, patch: Record<string, unknown>) {
    setActionLoading(true); setActionMsg(null);
    try {
      const res = await fetch("/api/dashboard/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: id, ...patch }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Update failed");
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...patch, status: String(patch.status ?? t.status) } as TaskRow : t));
      setEditingId(null);
      setActionMsg("Updated.");
      loadStats();
    } catch (e) { setActionMsg(e instanceof Error ? e.message : "Error"); }
    finally { setActionLoading(false); }
  }

  async function markDone(id: string) {
    await updateTask(id, { status: "done" });
  }

  function startEdit(task: TaskRow) {
    setEditingId(task.id);
    setEditFields({ title: task.title, description: task.description, priority: task.priority, due_at: task.due_at });
  }

  const filtered = tasks.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return t.title.toLowerCase().includes(s) || (t.description ?? "").toLowerCase().includes(s);
  });

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
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col justify-center">
            <h3 className="text-xs font-semibold text-gray-500">Tasks Performed (30 days)</h3>
            <div className="mt-2 text-4xl font-bold text-gray-900">{stats.performed}</div>
            <p className="mt-1 text-xs text-gray-500">out of {stats.total} total tasks</p>
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
            <select value={addFields.lead_id} onChange={(e) => setAddFields((f) => ({ ...f, lead_id: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
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

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks..."
          className="flex-1 min-w-[200px] max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
          <option value="open">Open</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
          <option value="all">All</option>
        </select>
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
                      <td className="px-4 py-2 text-xs text-gray-500">{t.lead_id ? leadMap.get(t.lead_id) ?? t.lead_id : "\u2014"}</td>
                      <td className="px-4 py-2"><input type="datetime-local" value={editFields.due_at ? new Date(editFields.due_at).toISOString().slice(0, 16) : ""} onChange={(e) => setEditFields((f) => ({ ...f, due_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} className="rounded border border-gray-300 px-2 py-1 text-sm" /></td>
                      <td className="px-4 py-2">
                        <select value={editFields.priority ?? "normal"} onChange={(e) => setEditFields((f) => ({ ...f, priority: e.target.value }))} className="rounded border border-gray-300 px-2 py-1 text-sm">
                          <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-xs">{t.status}</td>
                      <td className="px-4 py-2"><input value={editFields.description ?? ""} onChange={(e) => setEditFields((f) => ({ ...f, description: e.target.value }))} className="w-full rounded border border-gray-300 px-2 py-1 text-sm" placeholder="Notes" /></td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <button onClick={() => void updateTask(t.id, { title: editFields.title, description: editFields.description, priority: editFields.priority, dueAt: editFields.due_at })} disabled={actionLoading} className="text-xs font-medium text-blue-600 hover:text-blue-800 mr-2">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-xs font-medium text-gray-500 hover:text-gray-700">Cancel</button>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={t.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-gray-900">{t.title}</span>
                      {t.source !== "agent" && <span className="ml-1.5 text-[10px] text-gray-400 uppercase">{t.source}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{t.lead_id ? leadMap.get(t.lead_id) ?? `#${t.lead_id}` : "\u2014"}</td>
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
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {t.status === "open" && (
                        <button onClick={() => void markDone(t.id)} disabled={actionLoading} className="text-xs font-medium text-green-600 hover:text-green-800 mr-2">Complete</button>
                      )}
                      <button onClick={() => startEdit(t)} className="text-xs font-medium text-blue-600 hover:text-blue-800">Edit</button>
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
