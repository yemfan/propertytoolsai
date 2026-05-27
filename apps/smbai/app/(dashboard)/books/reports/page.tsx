import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { BooksNav } from "@/components/books-nav";
import { PeriodSelect } from "@/components/period-select";
import { TrendingUp, TrendingDown, Scale, DollarSign } from "lucide-react";

export const metadata: Metadata = { title: "Reports · Books" };

// ─── Types ────────────────────────────────────────────────────────────────────

type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

interface AccountBalance {
  code: string;
  name: string;
  type: AccountType;
  balance: number; // always positive; direction depends on type
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

async function getBalances(
  orgId: string,
  start: string,
  end: string
): Promise<AccountBalance[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("journal_lines")
    .select(`
      debit, credit,
      journal_entries!inner(organization_id, date),
      chart_of_accounts!inner(code, name, type)
    `)
    .eq("journal_entries.organization_id", orgId)
    .gte("journal_entries.date", start)
    .lte("journal_entries.date", end);

  if (!data?.length) return [];

  // Aggregate by account
  const map = new Map<string, AccountBalance>();
  for (const row of data) {
    const coaRaw = row.chart_of_accounts;
    const coa = (Array.isArray(coaRaw) ? coaRaw[0] : coaRaw) as { code: string; name: string; type: AccountType } | null;
    if (!coa) continue;
    const key = coa.code;
    const existing = map.get(key) ?? { code: coa.code, name: coa.name, type: coa.type, balance: 0 };

    const debit  = Number(row.debit  ?? 0);
    const credit = Number(row.credit ?? 0);

    // Normal balance direction:
    //   asset / expense  → debit increases (debit - credit = positive means balance)
    //   liability / equity / revenue → credit increases
    if (coa.type === "asset" || coa.type === "expense") {
      existing.balance += debit - credit;
    } else {
      existing.balance += credit - debit;
    }
    map.set(key, existing);
  }

  return Array.from(map.values()).filter((a) => a.balance !== 0);
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
}

// ─── Period helpers ───────────────────────────────────────────────────────────

function getPeriod(period: string): { label: string; start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  if (period === "ytd") {
    return {
      label: `YTD ${y}`,
      start: `${y}-01-01`,
      end: now.toISOString().slice(0, 10),
    };
  }
  if (period === "last_month") {
    const d = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    return {
      label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      start: d.toISOString().slice(0, 10),
      end: last.toISOString().slice(0, 10),
    };
  }
  if (period === "q1") return { label: `Q1 ${y}`, start: `${y}-01-01`, end: `${y}-03-31` };
  if (period === "q2") return { label: `Q2 ${y}`, start: `${y}-04-01`, end: `${y}-06-30` };
  if (period === "q3") return { label: `Q3 ${y}`, start: `${y}-07-01`, end: `${y}-09-30` };
  if (period === "q4") return { label: `Q4 ${y}`, start: `${y}-10-01`, end: `${y}-12-31` };

  // Default: current month
  const first = new Date(y, m, 1);
  const last  = new Date(y, m + 1, 0);
  return {
    label: first.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    start: first.toISOString().slice(0, 10),
    end:   last.toISOString().slice(0, 10),
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTable({
  title,
  rows,
  total,
  totalLabel,
  positive,
}: {
  title: string;
  rows: AccountBalance[];
  total: number;
  totalLabel: string;
  positive: boolean;
}) {
  if (!rows.length) {
    return (
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{title}</h3>
        <p className="text-xs text-slate-400 italic pl-2">No activity this period</p>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{title}</h3>
      <div className="space-y-0.5">
        {rows
          .sort((a, b) => a.code.localeCompare(b.code))
          .map((row) => (
            <div key={row.code} className="flex items-center gap-4 px-3 py-1.5 rounded-lg hover:bg-slate-50 group">
              <span className="w-12 text-xs text-slate-400 tabular-nums font-mono">{row.code}</span>
              <span className="flex-1 text-sm text-slate-700 truncate">{row.name}</span>
              <span
                className={`text-sm font-medium tabular-nums ${
                  positive ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {fmt(row.balance)}
              </span>
            </div>
          ))}
      </div>
      <div className="flex items-center gap-4 px-3 py-2 mt-1 border-t border-slate-200">
        <span className="flex-1 text-xs font-semibold text-slate-600">{totalLabel}</span>
        <span className={`text-sm font-bold tabular-nums ${positive ? "text-emerald-700" : "text-rose-700"}`}>
          {fmt(total)}
        </span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period = params.period ?? "current_month";

  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value ?? "";

  const { label, start, end } = getPeriod(period);
  const balances = await getBalances(orgId, start, end);

  const byType = (type: AccountType) => balances.filter((b) => b.type === type);

  // P&L figures
  const revenues  = byType("revenue");
  const expenses  = byType("expense");
  const totalRev  = revenues.reduce((s, b) => s + b.balance, 0);
  const totalExp  = expenses.reduce((s, b) => s + b.balance, 0);
  const netIncome = totalRev - totalExp;

  // Balance sheet
  const assets      = byType("asset");
  const liabilities = byType("liability");
  const equity      = byType("equity");
  const totalAssets = assets.reduce((s, b) => s + b.balance, 0);
  const totalLiab   = liabilities.reduce((s, b) => s + b.balance, 0);
  const totalEquity = equity.reduce((s, b) => s + b.balance, 0) + netIncome; // retained earnings
  const balanced    = Math.abs(totalAssets - (totalLiab + totalEquity)) < 0.01;

  const PERIODS = [
    { value: "current_month", label: "This month" },
    { value: "last_month",    label: "Last month" },
    { value: "ytd",           label: "Year-to-date" },
    { value: "q1",            label: "Q1" },
    { value: "q2",            label: "Q2" },
    { value: "q3",            label: "Q3" },
    { value: "q4",            label: "Q4" },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Books</h1>
          <p className="text-sm text-slate-500 mt-0.5">AI-powered bookkeeping — cash basis, double-entry</p>
        </div>
        <PeriodSelect options={PERIODS} value={period} />
      </div>

      <BooksNav />

      <p className="text-xs text-slate-400 mb-6">Period: {label} &nbsp;·&nbsp; {start} → {end}</p>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-semibold text-emerald-700 font-mono">{fmt(totalRev)}</div>
          <div className="text-xs text-slate-400 mt-0.5">{revenues.length} account{revenues.length !== 1 ? "s" : ""}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Expenses</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-semibold text-rose-700 font-mono">{fmt(totalExp)}</div>
          <div className="text-xs text-slate-400 mt-0.5">{expenses.length} account{expenses.length !== 1 ? "s" : ""}</div>
        </div>

        <div className={`rounded-xl border p-5 ${netIncome >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Net Income</span>
            <DollarSign className={`w-4 h-4 ${netIncome >= 0 ? "text-emerald-500" : "text-rose-500"}`} />
          </div>
          <div className={`text-2xl font-semibold font-mono ${netIncome >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {netIncome < 0 ? "–" : ""}{fmt(netIncome)}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Revenue − Expenses</div>
        </div>
      </div>

      {/* ── Two column: P&L + Balance Sheet ── */}
      <div className="grid grid-cols-2 gap-6">

        {/* P&L */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-slate-800">Profit & Loss</h2>
          </div>

          <SectionTable
            title="Revenue"
            rows={revenues}
            total={totalRev}
            totalLabel="Total Revenue"
            positive={true}
          />
          <SectionTable
            title="Expenses"
            rows={expenses}
            total={totalExp}
            totalLabel="Total Expenses"
            positive={false}
          />

          <div className={`flex items-center gap-4 px-3 py-3 rounded-lg mt-2 ${
            netIncome >= 0 ? "bg-emerald-50" : "bg-rose-50"
          }`}>
            <span className="flex-1 text-sm font-bold text-slate-700">Net Income</span>
            <span className={`text-sm font-bold tabular-nums ${netIncome >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {netIncome < 0 ? "–" : ""}{fmt(netIncome)}
            </span>
          </div>
        </div>

        {/* Balance Sheet */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Scale className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-slate-800">Balance Sheet</h2>
            {!balanced && balances.length > 0 && (
              <span className="ml-auto text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full">
                ⚠ Out of balance
              </span>
            )}
          </div>

          <SectionTable
            title="Assets"
            rows={assets}
            total={totalAssets}
            totalLabel="Total Assets"
            positive={true}
          />
          <SectionTable
            title="Liabilities"
            rows={liabilities}
            total={totalLiab}
            totalLabel="Total Liabilities"
            positive={false}
          />
          <SectionTable
            title="Equity"
            rows={equity}
            total={totalEquity}
            totalLabel="Total Equity (incl. Net Income)"
            positive={true}
          />

          {balances.length > 0 && (
            <div className={`flex items-center gap-4 px-3 py-3 rounded-lg mt-2 ${
              balanced ? "bg-slate-50" : "bg-amber-50"
            }`}>
              <span className="flex-1 text-xs font-semibold text-slate-500">Assets = Liabilities + Equity</span>
              <span className={`text-xs font-bold ${balanced ? "text-slate-600" : "text-amber-700"}`}>
                {balanced ? "✓ Balanced" : `Δ ${fmt(Math.abs(totalAssets - totalLiab - totalEquity))}`}
              </span>
            </div>
          )}

          {!balances.length && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Scale className="w-8 h-8 text-slate-200 mb-2" />
              <p className="text-xs text-slate-400">No journal entries for this period</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
