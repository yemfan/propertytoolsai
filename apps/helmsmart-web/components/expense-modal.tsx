"use client";

import { useState, useTransition } from "react";
import { X, Plus, Receipt } from "lucide-react";
import { createExpense } from "@/lib/actions/expenses";

interface ExpenseAccount {
  id: string;
  code: string;
  name: string;
}

interface BankAccount {
  id: string;
  name: string;
  mask: string | null;
  coa_account_id: string | null;
}

interface Props {
  expenseAccounts: ExpenseAccount[];
  bankAccounts: BankAccount[];
}

export function ExpenseModal({ expenseAccounts, bankAccounts }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseAccountId, setExpenseAccountId] = useState(expenseAccounts[0]?.id ?? "");
  const [paymentSourceId, setPaymentSourceId] = useState<string>(
    bankAccounts.find((b) => b.coa_account_id)?.id ?? "__payable__"
  );

  function handleOpen() {
    setOpen(true);
    setError(null);
    setSuccess(false);
  }

  function handleClose() {
    if (isPending) return;
    setOpen(false);
    setAmount("");
    setDescription("");
    setError(null);
    setSuccess(false);
  }

  function handleSubmit() {
    const parsed = parseFloat(amount);
    if (!description.trim())        { setError("Description is required"); return; }
    if (!parsed || parsed <= 0)     { setError("Enter a valid amount"); return; }
    if (!expenseAccountId)          { setError("Select an expense account"); return; }

    setError(null);
    startTransition(async () => {
      try {
        await createExpense({
          date,
          amount: +parsed.toFixed(2),
          description: description.trim(),
          expenseAccountId,
          paymentSourceId: paymentSourceId === "__payable__" ? null : paymentSourceId,
        });
        setSuccess(true);
        setTimeout(handleClose, 1200);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to save expense");
      }
    });
  }

  const mappedBanks = bankAccounts.filter((b) => b.coa_account_id);

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium
                   bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span>Add Expense</span>
        <span className="text-xs text-slate-400">Manual entry</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Receipt className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-800">Add expense</h3>
              </div>
              <button onClick={handleClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {success && (
                <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                  Expense recorded and journal entry posted!
                </p>
              )}
              {error && (
                <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</p>
              )}

              {/* Date + Amount row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Amount ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Office supplies, Software subscription…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Expense account */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Category (expense account)</label>
                {expenseAccounts.length === 0 ? (
                  <p className="text-xs text-slate-400">No expense accounts found. Complete onboarding to seed your CoA.</p>
                ) : (
                  <select
                    value={expenseAccountId}
                    onChange={(e) => setExpenseAccountId(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {expenseAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Payment source */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Paid from</label>
                <select
                  value={paymentSourceId}
                  onChange={(e) => setPaymentSourceId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {mappedBanks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}{b.mask ? ` ···${b.mask}` : ""}
                    </option>
                  ))}
                  <option value="__payable__">Will pay later (Accounts Payable)</option>
                </select>
                <p className="text-xs text-slate-400 mt-1.5">
                  Journal: DR {expenseAccounts.find((a) => a.id === expenseAccountId)?.name ?? "Expense"} /
                  CR {paymentSourceId === "__payable__" ? "Accounts Payable" : (bankAccounts.find((b) => b.id === paymentSourceId)?.name ?? "Bank")}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={handleClose}
                disabled={isPending}
                className="flex-1 py-2 border border-slate-200 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending || !expenseAccountId || expenseAccounts.length === 0}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
              >
                {isPending ? "Posting…" : "Save expense"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
