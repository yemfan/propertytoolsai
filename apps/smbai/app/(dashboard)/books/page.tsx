import type { Metadata } from "next";
import { TrendingUp, TrendingDown, DollarSign, Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { PlaidLink } from "@/components/plaid-link";
import { BooksNav } from "@/components/books-nav";
import { ExpenseModal } from "@/components/expense-modal";
import { PeriodSelect } from "@/components/period-select";

export const metadata: Metadata = { title: "Books" };

/** Fetch live bank account balances for the org. */
async function getBankSummary(orgId: string) {
  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("bank_accounts")
    .select("current_balance, type, is_active")
    .eq("organization_id", orgId)
    .eq("is_active", true);

  if (!accounts?.length) return { totalBalance: null, hasBank: false };

  // Sum depository accounts for "bank balance"; subtract credit liabilities
  const totalBalance = accounts.reduce((sum, a) => {
    const bal = a.current_balance ?? 0;
    return a.type === "credit" ? sum - bal : sum + bal;
  }, 0);

  return { totalBalance, hasBank: true };
}

/** Fetch revenue / expenses from posted bank_transactions for a given month (YYYY-MM). */
async function getMonthTotals(orgId: string, yearMonth: string) {
  const supabase = await createClient();
  const [year, month] = yearMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1).toISOString().slice(0, 10);
  const lastDay  = new Date(year, month, 0).toISOString().slice(0, 10);

  const { data: txns } = await supabase
    .from("bank_transactions")
    .select("amount")
    .eq("organization_id", orgId)
    .eq("pending", false)
    .gte("date", firstDay)
    .lte("date", lastDay);

  if (!txns?.length) return { revenue: null, expenses: null };

  // Plaid convention: positive = money OUT (expense), negative = money IN (income)
  let revenue = 0;
  let expenses = 0;
  for (const t of txns) {
    if (t.amount < 0) revenue += Math.abs(t.amount);
    else expenses += t.amount;
  }
  return { revenue, expenses };
}

function buildMonthOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    opts.push({ value, label });
  }
  return opts;
}

function fmt(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value ?? "";

  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const selectedMonth = monthParam ?? currentYearMonth;
  const monthLabel = new Date(selectedMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const monthOptions = buildMonthOptions();

  const supabase = await createClient();

  const [{ totalBalance, hasBank }, { revenue, expenses }, expenseAccountsRes, bankAccountsRes] = await Promise.all([
    getBankSummary(orgId),
    getMonthTotals(orgId, selectedMonth),
    supabase
      .from("chart_of_accounts")
      .select("id, code, name")
      .eq("organization_id", orgId)
      .eq("type", "expense")
      .eq("is_active", true)
      .order("code"),
    supabase
      .from("bank_accounts")
      .select("id, name, mask, coa_account_id")
      .eq("organization_id", orgId)
      .eq("is_active", true),
  ]);

  const expenseAccounts = expenseAccountsRes.data ?? [];
  const bankAccounts    = bankAccountsRes.data ?? [];

  const netProfit = revenue !== null && expenses !== null ? revenue - expenses : null;

  const stats = [
    {
      label: "Bank Balance",
      value: fmt(totalBalance),
      icon: DollarSign,
      sub: hasBank ? "All linked accounts" : "Link your bank to sync",
      color: "text-slate-400",
    },
    {
      label: "Revenue",
      value: fmt(revenue),
      icon: TrendingUp,
      sub: revenue !== null ? monthLabel : "No transactions yet",
      color: "text-emerald-500",
    },
    {
      label: "Expenses",
      value: fmt(expenses),
      icon: TrendingDown,
      sub: expenses !== null ? monthLabel : "No transactions yet",
      color: "text-rose-500",
    },
    {
      label: "Net Profit",
      value: fmt(netProfit),
      icon: DollarSign,
      sub: netProfit !== null ? monthLabel : "No transactions yet",
      color: netProfit !== null && netProfit >= 0 ? "text-indigo-500" : "text-rose-500",
    },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Books</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            AI-powered bookkeeping — cash basis, double-entry
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelect
            value={selectedMonth}
            options={monthOptions}
            paramName="month"
            basePath="/books"
          />
        </div>
      </div>

      <BooksNav />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, sub, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {label}
              </span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="text-2xl font-semibold text-slate-800 mb-1 font-mono">
              {value}
            </div>
            <div className="text-xs text-slate-400">{sub}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">
          {hasBank ? "Actions" : "Get started"}
        </h2>
        <div className="flex flex-wrap gap-3">
          {/* Live Plaid link button */}
          <PlaidLink />

          <ExpenseModal
            expenseAccounts={expenseAccounts as { id: string; code: string; name: string }[]}
            bankAccounts={bankAccounts as { id: string; name: string; mask: string | null; coa_account_id: string | null }[]}
          />
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Transactions</h2>
          {!hasBank && (
            <span className="text-xs text-slate-400">Link a bank to start syncing</span>
          )}
        </div>

        {hasBank ? (
          <TransactionList orgId={orgId} />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mb-3">
              <Link2 className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600 mb-1">No bank connected yet</p>
            <p className="text-xs text-slate-400 max-w-xs">
              Link your bank via Plaid and we&apos;ll import the last 90 days, categorized by AI.
            </p>
            <div className="mt-4">
              <PlaidLink />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Recent transactions table (rendered only when a bank is connected). */
async function TransactionList({ orgId }: { orgId: string }) {
  const supabase = await createClient();
  const { data: txns } = await supabase
    .from("bank_transactions")
    .select(`
      id, date, name, merchant_name, amount, pending,
      personal_finance_category, reviewed,
      bank_accounts!inner(name, mask)
    `)
    .eq("organization_id", orgId)
    .order("date", { ascending: false })
    .limit(50);

  if (!txns?.length) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        Syncing transactions… check back in a moment.
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {txns.map((t) => {
        // Plaid: positive = spend (debit), negative = income (credit)
        const isDebit = t.amount > 0;
        const displayAmount = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(Math.abs(t.amount));

        return (
          <div
            key={t.id}
            className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition-colors"
          >
            {/* Date */}
            <span className="w-20 flex-shrink-0 text-xs text-slate-400 tabular-nums">
              {new Date(t.date + "T00:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>

            {/* Description */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-800 truncate">
                {t.merchant_name ?? t.name}
                {t.pending && (
                  <span className="ml-2 text-xs text-amber-600 font-medium">Pending</span>
                )}
              </p>
              {t.personal_finance_category && (
                <p className="text-xs text-slate-400 truncate">
                  {t.personal_finance_category.replace(/_/g, " ").toLowerCase()}
                </p>
              )}
            </div>

            {/* Review indicator */}
            {!t.reviewed && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" title="Needs review" />
            )}

            {/* Amount */}
            <span
              className={`text-sm font-medium tabular-nums flex-shrink-0 ${
                isDebit ? "text-rose-600" : "text-emerald-600"
              }`}
            >
              {isDebit ? "-" : "+"}{displayAmount}
            </span>
          </div>
        );
      })}
    </div>
  );
}
