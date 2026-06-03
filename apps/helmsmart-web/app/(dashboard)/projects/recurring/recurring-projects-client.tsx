"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Repeat, X, Clock, DollarSign, AlertCircle, Play, Pause, Calendar } from "lucide-react";
import {
  createRecurringProject,
  setRecurringProjectStatus,
  deleteRecurringProject,
  type RecurringProject,
  type RecurringFrequency,
} from "@/lib/actions/recurring-projects";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ProjectColor = "indigo" | "emerald" | "rose" | "amber" | "violet" | "slate";

const COLOR_CLASSES: Record<ProjectColor, { dot: string; bg: string; text: string }> = {
  indigo:  { dot: "bg-indigo-500",  bg: "bg-indigo-50",  text: "text-indigo-700" },
  emerald: { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
  rose:    { dot: "bg-rose-500",    bg: "bg-rose-50",    text: "text-rose-700" },
  amber:   { dot: "bg-amber-500",   bg: "bg-amber-50",   text: "text-amber-700" },
  violet:  { dot: "bg-violet-500",  bg: "bg-violet-50",  text: "text-violet-700" },
  slate:   { dot: "bg-slate-400",   bg: "bg-slate-100",  text: "text-slate-600" },
};

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};

const FREQUENCIES: RecurringFrequency[] = ["weekly", "monthly", "quarterly", "annually"];

function clientName(c: { first_name: string | null; last_name: string | null; company: string | null } | null | undefined): string {
  if (!c) return "";
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company || "";
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function defaultNextRun(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

// ─── New recurring project modal ───────────────────────────────────────────────

function NewRecurringModal({
  clients,
  onClose,
  onCreated,
}: {
  clients: { id: string; first_name: string | null; last_name: string | null; company: string | null }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName]           = useState("");
  const [description, setDesc]    = useState("");
  const [clientId, setClientId]   = useState("");
  const [color, setColor]         = useState<ProjectColor>("indigo");
  const [budgetHours, setBudH]    = useState("");
  const [hourlyRate, setRate]     = useState("");
  const [frequency, setFreq]      = useState<RecurringFrequency>("monthly");
  const [nextRunDate, setNextRun] = useState(defaultNextRun());
  const [error, setError]         = useState("");
  const [isPending, start]        = useTransition();

  const COLORS: ProjectColor[] = ["indigo", "emerald", "rose", "amber", "violet", "slate"];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Template name is required"); return; }
    if (!nextRunDate) { setError("First run date is required"); return; }
    setError("");
    start(async () => {
      try {
        await createRecurringProject({
          name: name.trim(),
          description: description.trim() || null,
          clientId: clientId || null,
          color,
          budgetHours: budgetHours ? parseFloat(budgetHours) : null,
          hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
          frequency,
          nextRunDate,
        });
        onCreated();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create recurring project");
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">New recurring project</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <p className="text-xs text-rose-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Template name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Monthly retainer" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <p className="text-[11px] text-slate-400 mt-1">Each cycle spawns a project named e.g. &ldquo;{name.trim() || "Monthly retainer"} — May 2026&rdquo;.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Recurring scope of work…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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
            <label className="block text-xs font-medium text-slate-600 mb-1">Color</label>
            <div className="flex items-center gap-2 mt-1">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} className={`w-6 h-6 rounded-full ${COLOR_CLASSES[c].dot} transition-transform ${color === c ? "scale-125 ring-2 ring-offset-1 ring-slate-400" : ""}`} />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Budget hours</label>
            <input type="number" min="0" step="0.5" value={budgetHours} onChange={(e) => setBudH(e.target.value)} placeholder="0" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Hourly rate</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input type="number" min="0" step="0.01" value={hourlyRate} onChange={(e) => setRate(e.target.value)} placeholder="0" className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
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
            <label className="block text-xs font-medium text-slate-600 mb-1">First run date</label>
            <input type="date" value={nextRunDate} onChange={(e) => setNextRun(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={isPending} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {isPending ? "Creating…" : "Create template"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Recurring row ──────────────────────────────────────────────────────────────

function RecurringRow({
  rec,
  onChanged,
  onDeleted,
}: {
  rec: RecurringProject;
  onChanged: (id: string, status: "active" | "paused") => void;
  onDeleted: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, start] = useTransition();
  const c = COLOR_CLASSES[rec.color as ProjectColor] ?? COLOR_CLASSES.indigo;
  const paused = rec.status === "paused";

  function toggleStatus() {
    const next = paused ? "active" : "paused";
    start(async () => {
      await setRecurringProjectStatus(rec.id, next);
      onChanged(rec.id, next);
    });
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    start(async () => {
      await deleteRecurringProject(rec.id);
      onDeleted(rec.id);
    });
  }

  return (
    <div className="flex items-center gap-4 px-5 py-4 group">
      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${c.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-800 truncate">{rec.name}</p>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
            {FREQUENCY_LABELS[rec.frequency]}
          </span>
          {paused && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Paused</span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {clientName(rec.clients) && <span>{clientName(rec.clients)}</span>}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {paused ? "Paused" : `Next ${fmtDate(rec.next_run_date)}`}
          </span>
          {rec.budget_hours && (
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{rec.budget_hours}h</span>
          )}
          {rec.hourly_rate && (
            <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />${rec.hourly_rate}/hr</span>
          )}
          {rec.last_generated_at && (
            <span>Last spawned {new Date(rec.last_generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
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
          confirmDelete
            ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
            : "text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100"
        }`}
      >
        {confirmDelete ? "Confirm" : "Delete"}
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  initialRecurring: RecurringProject[];
  clients: { id: string; first_name: string | null; last_name: string | null; company: string | null }[];
}

export function RecurringProjectsClient({ initialRecurring, clients }: Props) {
  const [recurring, setRecurring] = useState<RecurringProject[]>(initialRecurring);
  const [showNew, setShowNew]     = useState(false);

  const activeCount = recurring.filter((r) => r.status === "active").length;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">Recurring projects</h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeCount} active template{activeCount === 1 ? "" : "s"} · auto-spawn new projects on a schedule
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/projects"
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Projects
          </Link>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New recurring
          </button>
        </div>
      </div>

      {recurring.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl">
          <Repeat className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500 mb-1">No recurring projects yet</p>
          <p className="text-xs text-slate-400 mb-4 max-w-sm">
            Set up a retainer or recurring engagement once — we&rsquo;ll spawn a fresh project each cycle so your time entries and invoices stay organized by period.
          </p>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
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
              onChanged={(id, status) =>
                setRecurring((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)))
              }
              onDeleted={(id) => setRecurring((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 mt-4">
        Active templates are checked daily. When a template&rsquo;s next run date arrives, a new project is created and the date advances by its frequency. Pause to skip upcoming cycles without losing the template.
      </p>

      {showNew && (
        <NewRecurringModal
          clients={clients}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            // Re-fetch via revalidatePath happens server-side; reflect optimistically by reloading.
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
