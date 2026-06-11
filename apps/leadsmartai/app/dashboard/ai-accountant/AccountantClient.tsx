"use client";

import Link from "next/link";
import { getAssistant } from "@/lib/realtorboss/team";
import { AssistantHeader, AssistantKpiCard } from "@/components/realtorboss/AssistantPage";

type InvoiceItem = {
  id: string;
  invoice_number: string;
  client_name: string | null;
  status: string;
  due_date: string | null;
  total: number;
};

type ExpenseItem = {
  id: string;
  expense_date: string;
  amount: number;
  category: string;
  vendor: string | null;
};

const assistant = getAssistant("accountant");

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtDay(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
}

const STATUS_CHIP: Record<string, string> = {
  overdue: "bg-red-100 text-red-700",
  sent: "bg-amber-100 text-amber-700",
  draft: "bg-gray-100 text-gray-600",
  paid: "bg-emerald-100 text-emerald-700",
  void: "bg-gray-100 text-gray-400",
};

export default function AccountantClient({
  invoices,
  expensesMonthTotal,
  expensesByCategory,
  recentExpenses,
  commissionPipeline,
  activeDeals,
}: {
  invoices: InvoiceItem[];
  expensesMonthTotal: number;
  expensesByCategory: { category: string; total: number }[];
  recentExpenses: ExpenseItem[];
  commissionPipeline: number;
  activeDeals: number;
}) {
  const open = invoices.filter((i) => i.status === "sent" || i.status === "overdue");
  const overdue = invoices.filter((i) => i.status === "overdue");
  const outstanding = open.reduce((s, i) => s + (i.total || 0), 0);
  const overdueAmount = overdue.reduce((s, i) => s + (i.total || 0), 0);
  const topCategories = [...expensesByCategory].sort((a, b) => b.total - a.total).slice(0, 3);

  return (
    <div className="space-y-4">
      <AssistantHeader
        assistant={assistant}
        actions={[
          { label: "Invoices", href: "/dashboard/books" },
          { label: "Expenses", href: "/dashboard/expenses" },
          { label: "Manage", href: "/dashboard/ai-team" },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AssistantKpiCard label="Outstanding invoices" value={money(outstanding)} hint={`${open.length} open`} />
        <AssistantKpiCard
          label="Overdue"
          value={money(overdueAmount)}
          hint={`${overdue.length} invoice${overdue.length === 1 ? "" : "s"}`}
          tone={overdue.length > 0 ? "hot" : undefined}
        />
        <AssistantKpiCard label="Expenses this month" value={money(expensesMonthTotal)} />
        <AssistantKpiCard label="Commission pipeline" value={money(commissionPipeline)} hint={`${activeDeals} active deal${activeDeals === 1 ? "" : "s"} · expected net`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Money owed to you ── */}
        <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Money owed to you</h2>
            <Link href="/dashboard/books" className="text-xs font-medium text-blue-600 hover:text-blue-800">All invoices</Link>
          </div>
          {invoices.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              Your AI Accountant is ready — create your first invoice in Books and it will be tracked from sent to paid.
            </p>
          ) : (
            <div className="space-y-2">
              {[...overdue, ...invoices.filter((i) => i.status !== "overdue")].slice(0, 8).map((i) => (
                <Link key={i.id} href="/dashboard/books" className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {i.invoice_number} · {i.client_name ?? "—"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {money(i.total || 0)}{i.due_date ? ` · due ${fmtDay(i.due_date)}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CHIP[i.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {i.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Spending this month ── */}
        <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Spending this month</h2>
            <Link href="/dashboard/expenses" className="text-xs font-medium text-blue-600 hover:text-blue-800">All expenses</Link>
          </div>
          {topCategories.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {topCategories.map((c) => (
                <span key={c.category} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                  {c.category}: {money(c.total)}
                </span>
              ))}
            </div>
          )}
          {recentExpenses.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              No expenses logged yet — track them and your AI Accountant will keep the categories clean for tax time.
            </p>
          ) : (
            <div className="space-y-2">
              {recentExpenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{e.vendor ?? e.category}</p>
                    <p className="text-xs text-gray-500">{e.category} · {fmtDay(e.expense_date)}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-gray-700">{money(e.amount || 0)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
