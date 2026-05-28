"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Repeat, X, AlertCircle, Play, Pause, Calendar } from "lucide-react";
import {
  createRecurringTask,
  setRecurringTaskStatus,
  deleteRecurringTask,
  type RecurringTask,
  type RecurringFrequency,
  type TaskPriority,
} from "@/lib/actions/recurring-tasks";

type ClientLite = { id: string; first_name: string | null; last_name: string | null; company: string | null };

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};
const FREQUENCIES: RecurringFrequency[] = ["weekly", "monthly", "quarterly", "annually"];

const PRIORITY: Record<TaskPriority, { label: string; cls: string }> = {
  urgent: { label: "Urgent", cls: "bg-rose-50 text-rose-700" },
  high:   { label: "High",   cls: "bg-amber-50 text-amber-700" },
  normal: { label: "Normal", cls: "bg-slate-100 text-slate-500" },
  low:    { label: "Low",    cls: "bg-slate-100 text-slate-400" },
};
const PRIORITIES: TaskPriority[] = ["low", "normal", "high", "urgent"];

function clientName(c: ClientLite | { first_name: string | null; last_name: string | null; company: string | null } | null | undefined): string {
  if (!c) return "";
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company || "";
}
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function defaultNextRun(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

// ─── New recurring task modal ───────────────────────────────────────────────────

function NewRecurringTaskModal({
  clients,
  onClose,
  onSaved,
}: {
  clients: ClientLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle]         = useState("");
  const [notes, setNotes]         = useState("");
  const [clientId, setClientId]   = useState("");
  const [priority, setPriority]   = useState<TaskPriority>("normal");
  const [frequency, setFreq]      = useState<RecurringFrequency>("weekly");
  const [nextRunDate, setNextRun] = useState(defaultNextRun());
  const [error, setError]         = useState("");
  const [isPending, start]        = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }
    if (!nextRunDate) { setError("First date is required"); return; }
    setError("");
    start(async () => {
      try {
        await createRecurringTask({
          title: title.trim(),
          notes: notes.trim() || null,
          clientId: clientId || null,
          priority,
          frequency,
          nextRunDate,
        });
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create recurring task");
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-800">New recurring task</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <p className="text-xs text-rose-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Run payroll" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Details, checklist, links…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Client</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">No client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{clientName(c)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Frequency</label>
            <select value={frequency} onChange={(e) => setFreq(e.target.value as RecurringFrequency)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {FREQUENCIES.map((f) => <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">First date</label>
            <input type="date" value={nextRunDate} onChange={(e) => setNextRun(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          A fresh open task is created each cycle, due on its run date — then the date advances by the frequency.
        </p>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={isPending} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {isPending ? "Saving…" : "Save template"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Row ───────────────────────────────────────────────────────────────────────

function RecurringRow({
  rec,
  onChanged,
  onDeleted,
}: {
  rec: RecurringTask;
  onChanged: (id: string, status: "active" | "paused") => void;
  onDeleted: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, start] = useTransition();
  const paused = rec.status === "paused";
  const pr = PRIORITY[rec.priority] ?? PRIORITY.normal;

  function toggleStatus() {
    const next = paused ? "active" : "paused";
    start(async () => {
      await setRecurringTaskStatus(rec.id, next);
      onChanged(rec.id, next);
    });
  }
  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    start(async () => {
      await deleteRecurringTask(rec.id);
      onDeleted(rec.id);
    });
  }

  return (
    <div className="flex items-center gap-4 px-5 py-4 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-800 truncate">{rec.title}</p>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
            {FREQUENCY_LABELS[rec.frequency]}
          </span>
          {rec.priority !== "normal" && (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${pr.cls}`}>{pr.label}</span>
          )}
          {paused && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Paused</span>}
        </div>
        <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {clientName(rec.clients) && <span>{clientName(rec.clients)}</span>}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {paused ? "Paused" : `Next ${fmtDate(rec.next_run_date)}`}
          </span>
          {rec.last_generated_at && (
            <span>Last {new Date(rec.last_generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          )}
        </p>
      </div>

      <button
        onClick={toggleStatus}
        disabled={isPending}
        title={paused ? "Resume" : "Pause"}
        className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50 transition-colors"
      >
        {paused ? <><Play className="w-3 h-3" /> Resume</> : <><Pause className="w-3 h-3" /> Pause</>}
      </button>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
          confirmDelete ? "bg-rose-100 text-rose-700 hover:bg-rose-200" : "text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100"
        }`}
      >
        {confirmDelete ? "Confirm" : "Delete"}
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────────

interface Props {
  initialRecurring: RecurringTask[];
  clients: ClientLite[];
}

export function RecurringTasksClient({ initialRecurring, clients }: Props) {
  const [recurring, setRecurring] = useState<RecurringTask[]>(initialRecurring);
  const [showNew, setShowNew]     = useState(false);

  const activeCount = recurring.filter((r) => r.status === "active").length;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Recurring tasks</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeCount} active · auto-create to-dos on a schedule
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/tasks" className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Tasks
          </Link>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" />
            New recurring
          </button>
        </div>
      </div>

      {recurring.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl">
          <Repeat className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500 mb-1">No recurring tasks yet</p>
          <p className="text-xs text-slate-400 mb-4 max-w-sm">
            Set up repeating chores once — payroll, quarterly filings, license renewals — and we&rsquo;ll add a fresh to-do each cycle so nothing slips.
          </p>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" />
            Create first template
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-50">
          {recurring.map((r) => (
            <RecurringRow
              key={r.id}
              rec={r}
              onChanged={(id, status) => setRecurring((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)))}
              onDeleted={(id) => setRecurring((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 mt-4">
        Active templates are checked daily. When a template&rsquo;s next date arrives, a new open task is created (due that day) and the date advances by its frequency. Pause to skip upcoming cycles.
      </p>

      {showNew && (
        <NewRecurringTaskModal
          clients={clients}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
