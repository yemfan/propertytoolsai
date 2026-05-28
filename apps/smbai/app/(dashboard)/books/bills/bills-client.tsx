"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, AlertCircle, Receipt, Trash2, CheckCircle2, Banknote } from "lucide-react";
import { createBill, payBill, deleteBill, type Bill } from "@/lib/actions/bills";

type ExpenseAccount = { id: string; code: string; name: string };
type BankAccount = { id: string; name: string; mask: string | null; coa_account_id: string | null };

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function plusDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysUntil(due: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(due + "T00:00:00").getTime() - today.getTime()) / 86_400_000);
}
function dueBadge(due: string): { label: string; cls: string } {
  const n = daysUntil(due);
  if (n < 0) return { label: `${Math.abs(n)}d overdue`, cls: "bg-rose-50 text-rose-700" };
  if (n === 0) return { label: "Due today", cls: "bg-amber-50 text-amber-700" };
  if (n <= 7) return { label: `Due in ${n}d`, cls: "bg-amber-50 text-amber-700" };
  return {
    label: `Due ${new Date(due + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    cls: "bg-slate-100 text-slate-500",
  };
}

// ─── New bill modal ─────────────────────────────────────────────────────────────

function NewBillModal({
  expenseAccounts,
  onClose,
  onSaved,
}: {
  expenseAccounts: ExpenseAccount[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [vendor, setVendor]               = useState("");
  const [billNumber, setBillNumber]       = useState("");
  const [description, setDescription]     = useState("");
  const [expenseAccountId, setExpenseAcc] = useState(expenseAccounts[0]?.id ?? "");
  const [amount, setAmount]               = useState("");
  const [issueDate, setIssueDate]         = useState(todayStr());
  const [dueDate, setDueDate]             = useState(plusDays(30));
  const [error, setError]                 = useState("");
  const [isPending, start]                = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!vendor.trim()) { setError("Vendor is required"); return; }
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    if (!dueDate) { setError("Due date is required"); return; }
    setError("");
    start(async () => {
      try {
        await createBill({
          vendor: vendor.trim(),
          description: description.trim() || null,
          billNumber: billNumber.trim() || null,
          expenseAccountId: expenseAccountId || null,
          issueDate,
          dueDate,
          amount: +amt.toFixed(2),
        });
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save bill");
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-800">New bill</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <p className="text-xs text-rose-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Vendor *</label>
            <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Acme Supplies" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Bill # <span className="text-slate-400 font-normal">(optional)</span></label>
            <input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} placeholder="INV-1042" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this bill for?" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div className="grid grid-cols-2 gap-3">
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
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Amount ($) *</label>
            <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Bill date</label>
            <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Due date *</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          Recording a bill just tracks the obligation. The expense posts to your books when you mark it paid.
        </p>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={isPending} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {isPending ? "Saving…" : "Save bill"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Pay bill modal ─────────────────────────────────────────────────────────────

function PayBillModal({
  bill,
  banks,
  onClose,
  onPaid,
}: {
  bill: Bill;
  banks: BankAccount[];
  onClose: () => void;
  onPaid: () => void;
}) {
  const [bankAccountId, setBankAccountId] = useState(banks[0]?.id ?? "");
  const [paymentDate, setPaymentDate]     = useState(todayStr());
  const [error, setError]                 = useState("");
  const [isPending, start]                = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!bankAccountId) { setError("Select a bank account"); return; }
    setError("");
    start(async () => {
      try {
        await payBill({ billId: bill.id, bankAccountId, paymentDate });
        onPaid();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to record payment");
      }
    });
  }

  const bankName = banks.find((b) => b.id === bankAccountId)?.name ?? "Bank";

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4 text-emerald-600" />
            <h2 className="text-base font-semibold text-slate-800">Pay bill</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-slate-50 rounded-lg px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">{bill.vendor}</span>
            <span className="text-base font-semibold text-slate-800 tabular-nums">{fmt(bill.amount)}</span>
          </div>
          {bill.description && <p className="text-xs text-slate-400 mt-0.5">{bill.description}</p>}
        </div>

        {error && <p className="text-xs text-rose-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}

        {banks.length === 0 ? (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            No bank account is mapped to your Chart of Accounts. Link a bank or set its CoA mapping in Settings first.
          </p>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Pay from</label>
              <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {banks.map((b) => <option key={b.id} value={b.id}>{b.name}{b.mask ? ` ···${b.mask}` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payment date</label>
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <p className="text-[11px] text-slate-400">
              Journal: DR {bill.expense_account?.name ?? "Expense"} / CR {bankName}
            </p>
          </>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={isPending || banks.length === 0} className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
            {isPending ? "Posting…" : "Record payment"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Bill row ────────────────────────────────────────────────────────────────────

function BillRow({
  bill,
  canPay,
  onPay,
  onChanged,
}: {
  bill: Bill;
  canPay: boolean;
  onPay: (b: Bill) => void;
  onChanged: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, start] = useTransition();
  const paid = bill.status === "paid";
  const badge = dueBadge(bill.due_date);

  function del() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    start(async () => {
      await deleteBill(bill.id);
      onChanged();
    });
  }

  return (
    <div className="flex items-center gap-4 px-5 py-4 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-800 truncate">{bill.vendor}</p>
          {bill.bill_number && <span className="text-xs text-slate-400">#{bill.bill_number}</span>}
          {paid ? (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Paid
            </span>
          ) : (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5 truncate">
          {bill.expense_account?.name ?? "Uncategorized"}
          {bill.description ? ` · ${bill.description}` : ""}
          {paid && bill.paid_at ? ` · Paid ${new Date(bill.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
        </p>
      </div>

      <span className="text-sm font-semibold text-slate-800 tabular-nums flex-shrink-0">{fmt(bill.amount)}</span>

      {!paid && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onPay(bill)}
            disabled={isPending || !canPay}
            title={canPay ? "Record payment" : "Link a bank account first"}
            className="text-xs font-medium px-2.5 py-1 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 transition-colors"
          >
            Mark paid
          </button>
          <button
            onClick={del}
            disabled={isPending}
            className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
              confirmDelete
                ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                : "text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100"
            }`}
          >
            {confirmDelete ? "Confirm" : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────────

function Kpi({ label, value, tone = "slate", sub }: { label: string; value: number; tone?: "slate" | "rose" | "amber"; sub?: string }) {
  const color = tone === "rose" ? "text-rose-600" : tone === "amber" ? "text-amber-600" : "text-slate-800";
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${color}`}>{fmt(value)}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────────

interface Props {
  initialBills: Bill[];
  expenseAccounts: ExpenseAccount[];
  bankAccounts: BankAccount[];
}

export function BillsClient({ initialBills, expenseAccounts, bankAccounts }: Props) {
  const router = useRouter();
  const [filter, setFilter]       = useState<"open" | "paid" | "all">("open");
  const [showNew, setShowNew]     = useState(false);
  const [payTarget, setPayTarget] = useState<Bill | null>(null);

  const mappedBanks = bankAccounts.filter((b) => b.coa_account_id);
  const canPay = mappedBanks.length > 0;

  const openBills = initialBills.filter((b) => b.status === "open");
  const totalOwed = openBills.reduce((s, b) => s + b.amount, 0);
  const overdue = openBills.filter((b) => daysUntil(b.due_date) < 0);
  const overdueAmount = overdue.reduce((s, b) => s + b.amount, 0);
  const dueSoon = openBills.filter((b) => { const n = daysUntil(b.due_date); return n >= 0 && n <= 7; });
  const dueSoonAmount = dueSoon.reduce((s, b) => s + b.amount, 0);

  const shown = filter === "all" ? initialBills : initialBills.filter((b) => b.status === filter);
  const paidCount = initialBills.length - openBills.length;

  function refresh() {
    setShowNew(false);
    setPayTarget(null);
    router.refresh();
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Bills</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Track what you owe vendors. Expenses post to your books when paid.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New bill
        </button>
      </div>

      {/* A/P KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Kpi label="Total owed" value={totalOwed} sub={`${openBills.length} open bill${openBills.length === 1 ? "" : "s"}`} />
        <Kpi label="Overdue" value={overdueAmount} tone={overdueAmount > 0 ? "rose" : "slate"} sub={`${overdue.length} past due`} />
        <Kpi label="Due in 7 days" value={dueSoonAmount} tone={dueSoonAmount > 0 ? "amber" : "slate"} sub={`${dueSoon.length} coming up`} />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4 bg-slate-100 rounded-xl p-1 w-fit">
        {(["open", "paid", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              filter === s ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {s === "open" ? `Open (${openBills.length})` : s === "paid" ? `Paid (${paidCount})` : "All"}
          </button>
        ))}
      </div>

      {/* List */}
      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl">
          <Receipt className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500 mb-1">
            {filter === "open" ? "No open bills" : filter === "paid" ? "No paid bills yet" : "No bills yet"}
          </p>
          <p className="text-xs text-slate-400 mb-4">Record a vendor bill to track what you owe and when it&rsquo;s due.</p>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" />
            New bill
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-50">
          {shown.map((b) => (
            <BillRow key={b.id} bill={b} canPay={canPay} onPay={setPayTarget} onChanged={refresh} />
          ))}
        </div>
      )}

      {showNew && (
        <NewBillModal expenseAccounts={expenseAccounts} onClose={() => setShowNew(false)} onSaved={refresh} />
      )}
      {payTarget && (
        <PayBillModal bill={payTarget} banks={mappedBanks} onClose={() => setPayTarget(null)} onPaid={refresh} />
      )}
    </div>
  );
}
