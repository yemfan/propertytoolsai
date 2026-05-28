"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Repeat, X, AlertCircle, Play, Pause, Calendar } from "lucide-react";
import {
  createRecurringBill,
  setRecurringBillStatus,
  deleteRecurringBill,
  type RecurringBill,
  type RecurringFrequency,
} from "@/lib/actions/recurring-bills";

type ExpenseAccount = { id: string; code: string; name: string };

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};
const FREQUENCIES: RecurringFrequency[] = ["weekly", "monthly", "quarterly", "annually"];

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function defaultNextRun(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

// ─── New recurring bill modal ───────────────────────────────────────────────────

function NewRecurringBillModal({
  expenseAccounts,
  onClose,
  onSaved,
}: {
  expenseAccounts: ExpenseAccount[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [vendor, setVendor]               = useState("");
  const [description, setDesc]            = useState("");
  const [expenseAccountId, setExpenseAcc] = useState(expenseAccounts[0]?.id ?? "");
  const [amount, setAmount]               = useState("");
  const [dueDays, setDueDays]             = useState("30");
  const [frequency, setFreq]              = useState<RecurringFrequency>("monthly");
  const [nextRunDate, setNextRun]         = useState(defaultNextRun());
  const [error, setError]                 = useState("");
  const [isPending, start]                = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!vendor.trim()) { setError("Vendor is required"); return; }
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    if (!nextRunDate) { setError("First run date is required"); return; }
    setError("");
    start(async () => {
      try {
        await createRecurringBill({
          vendor: vendor.trim(),
          description: description.trim() || null,
          expenseAccountId: expenseAccountId || null,
          amount: +amt.toFixed(2),
          dueDays: parseInt(dueDays, 10) || 0,
          frequency,
          nextRunDate,
        });
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create recurring bill");
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-800">New recurring bill</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <p className="text-xs text-rose-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Vendor *</label>
            <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Landlord LLC" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Amount ($) *</label>
            <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <input value={description} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Office rent, SaaS subscription…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Category (expense account)</label>
          {expenseAccounts.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No expense accounts — complete onboarding to seed your CoA.</p>
          ) : (
            <select value={expenseAccountId} onChange={(e) => setExpenseAcc(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {expenseAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
            </select>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
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
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Net (days)</label>
            <input type="number" min="0" step="1" value={dueDays} onChange={(e) => setDueDays(e.target.value)} placeholder="30" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          Each cycle spawns an open bill due {parseInt(dueDays, 10) || 0} day{(parseInt(dueDays, 10) || 0) === 1 ? "" : "s"} after it&rsquo;s generated. The expense posts to your books when you mark it paid.
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

// ─── Recurring bill row ───────────────────────────────────────────────────────────

function RecurringRow({
  rec,
  onChanged,
  onDeleted,
}: {
  rec: RecurringBill;
  onChanged: (id: string, status: "active" | "paused") => void;
  onDeleted: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, start] = useTransition();
  const paused = rec.status === "paused";

  function toggleStatus() {
    const next = paused ? "active" : "paused";
    start(async () => {
      await setRecurringBillStatus(rec.id, next);
      onChanged(rec.id, next);
    });
  }
  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    start(async () => {
      await deleteRecurringBill(rec.id);
      onDeleted(rec.id);
    });
  }

  return (
    <div className="flex items-center gap-4 px-5 py-4 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-800 truncate">{rec.vendor}</p>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
            {FREQUENCY_LABELS[rec.frequency]}
          </span>
          {paused && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Paused</span>}
        </div>
        <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span>{rec.expense_account?.name ?? "Uncategorized"}</span>
          {rec.description ? <span className="truncate">{rec.description}</span> : null}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {paused ? "Paused" : `Next ${fmtDate(rec.next_run_date)}`}
          </span>
          <span>Net {rec.due_days}d</span>
          {rec.last_generated_at && (
            <span>Last {new Date(rec.last_generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          )}
        </p>
      </div>

      <span className="text-sm font-semibold text-slate-800 tabular-nums flex-shrink-0">{fmt(rec.amount)}</span>

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
  initialRecurring: RecurringBill[];
  expenseAccounts: ExpenseAccount[];
}

export function RecurringBillsClient({ initialRecurring, expenseAccounts }: Props) {
  const [recurring, setRecurring] = useState<RecurringBill[]>(initialRecurring);
  const [showNew, setShowNew]     = useState(false);

  const activeCount = recurring.filter((r) => r.status === "active").length;
  const monthlyEstimate = recurring
    .filter((r) => r.status === "active")
    .reduce((s, r) => {
      const perMonth = r.frequency === "weekly" ? r.amount * 4.33 : r.frequency === "monthly" ? r.amount : r.frequency === "quarterly" ? r.amount / 3 : r.amount / 12;
      return s + perMonth;
    }, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Recurring bills</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeCount} active · ~{fmt(monthlyEstimate)}/mo · auto-generate open bills on a schedule
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/books/bills" className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Bills
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
          <p className="text-sm font-medium text-slate-500 mb-1">No recurring bills yet</p>
          <p className="text-xs text-slate-400 mb-4 max-w-sm">
            Set up rent, software subscriptions, or insurance once — we&rsquo;ll create a fresh open bill each cycle so nothing slips through the cracks.
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
        Active templates are checked daily. When a template&rsquo;s next date arrives, a new open bill is created (due Net-N days later) and the date advances by its frequency. Pause to skip upcoming cycles.
      </p>

      {showNew && (
        <NewRecurringBillModal
          expenseAccounts={expenseAccounts}
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
