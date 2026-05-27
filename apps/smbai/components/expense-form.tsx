"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createExpense } from "@/lib/actions/expenses";
import { DollarSign } from "lucide-react";

interface CoAAccount {
  id: string;
  code: string;
  name: string;
}

interface BankAccount {
  id: string;
  name: string;
  mask: string | null;
}

interface Props {
  expenseAccounts: CoAAccount[];
  bankAccounts: BankAccount[];
}

export function ExpenseForm({ expenseAccounts, bankAccounts }: Props) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate]                 = useState(today);
  const [amount, setAmount]             = useState("");
  const [description, setDescription]   = useState("");
  const [expenseAccountId, setExpenseAccountId] = useState(expenseAccounts[0]?.id ?? "");
  const [paymentSourceId, setPaymentSourceId]   = useState<string>(""); // "" = Accounts Payable
  const [error, setError]               = useState("");
  const [pending, start]                = useTransition();

  function handleSubmit() {
    const amt = parseFloat(amount);
    if (!date || isNaN(amt) || amt <= 0 || !description.trim() || !expenseAccountId) {
      setError("Date, amount, description, and expense account are required.");
      return;
    }
    setError("");
    start(async () => {
      try {
        await createExpense({
          date,
          amount: amt,
          description: description.trim(),
          expenseAccountId,
          paymentSourceId: paymentSourceId || null,
        });
        router.push("/books/expenses");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save expense");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-slate-800">Expense details</h2>

        {/* Date + Amount */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Amount</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full text-sm border border-slate-300 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Office supplies at Staples"
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Expense account (DR) */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Expense account</label>
          <select
            value={expenseAccountId}
            onChange={(e) => setExpenseAccountId(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            {expenseAccounts.length === 0 && (
              <option value="">No expense accounts in Chart of Accounts</option>
            )}
            {expenseAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">Debited (expense increases)</p>
        </div>

        {/* Payment source (CR) */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Paid from</label>
          <select
            value={paymentSourceId}
            onChange={(e) => setPaymentSourceId(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="">Accounts Payable (not yet paid)</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}{b.mask ? ` ···${b.mask}` : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">Credited (cash or liability increases)</p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-4 py-3">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={pending}
          className="flex-1 py-3 text-sm font-medium border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || !expenseAccountId}
          className="flex-1 py-3 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {pending ? "Saving…" : "Record expense"}
        </button>
      </div>
    </div>
  );
}
