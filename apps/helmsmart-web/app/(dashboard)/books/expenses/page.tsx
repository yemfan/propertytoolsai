import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { BooksNav } from "@/components/books-nav";
import { listExpenses } from "@/lib/actions/expenses";

export const metadata: Metadata = { title: "Expenses · Books" };

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export default async function ExpensesPage() {
  const expenses = await listExpenses(200);
  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <BooksNav />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Expenses</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {expenses.length} entries · {fmt(totalSpend)} total
          </p>
        </div>
        <Link
          href="/books/expenses/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Record expense
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-3">
              <Receipt className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600 mb-1">No expenses yet</p>
            <p className="text-xs text-slate-400 max-w-xs mb-5">
              Record manual expenses here. Bank-imported transactions are categorized automatically on the Transactions page.
            </p>
            <Link
              href="/books/expenses/new"
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Record first expense
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[120px_1fr_180px_120px] gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wide">
              <span>Date</span>
              <span>Description</span>
              <span>Account</span>
              <span className="text-right">Amount</span>
            </div>

            <div className="divide-y divide-slate-50">
              {expenses.map((e) => (
                <div
                  key={e.id}
                  className="grid grid-cols-[120px_1fr_180px_120px] gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors"
                >
                  <span className="text-sm text-slate-500 tabular-nums">
                    {new Date(e.date + "T00:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="text-sm text-slate-800 truncate">{e.memo ?? "—"}</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-mono text-slate-400">{e.accountCode}</span>
                    <span className="text-xs text-slate-600 truncate">{e.accountName}</span>
                  </div>
                  <span className="text-sm font-semibold text-rose-600 text-right tabular-nums">
                    {fmt(e.amount)}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer total */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
              <span className="text-sm font-semibold text-slate-700">Total</span>
              <span className="text-sm font-bold text-rose-700 tabular-nums">{fmt(totalSpend)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
