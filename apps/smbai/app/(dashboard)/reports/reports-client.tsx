"use client";

import { useState, useTransition } from "react";
import { Download, ChevronDown, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import type { PnLReport, CashFlowSummary } from "@/lib/actions/reports";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function thisYear() {
  const y = new Date().getFullYear();
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

function lastYear() {
  const y = new Date().getFullYear() - 1;
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

function thisMonth() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const last = new Date(y, d.getMonth() + 1, 0).getDate();
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${last}` };
}

function lastQuarter() {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3);
  const pq = q === 0 ? 3 : q - 1;
  const y = q === 0 ? d.getFullYear() - 1 : d.getFullYear();
  const starts = [1, 4, 7, 10];
  const sm = starts[pq];
  const em = sm + 2;
  const lastDay = new Date(y, em, 0).getDate();
  const fmt = (n: number) => String(n).padStart(2, "0");
  return { from: `${y}-${fmt(sm)}-01`, to: `${y}-${fmt(em)}-${lastDay}` };
}

const PRESETS = [
  { label: "This month",   fn: thisMonth },
  { label: "Last quarter", fn: lastQuarter },
  { label: "This year",    fn: thisYear },
  { label: "Last year",    fn: lastYear },
];

// ─── Currency formatter ───────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: number;
  sub?: string;
  positive?: boolean;
}) {
  const color =
    positive === undefined
      ? "text-slate-800"
      : positive
      ? "text-emerald-600"
      : "text-rose-600";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${color}`}>{fmt(value)}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportPnLCsv(report: PnLReport) {
  const rows: string[] = [
    "Type,Account Code,Account Name,Amount",
    ...report.revenue.map((r) => `Revenue,${r.account_code},"${r.account_name}",${r.total.toFixed(2)}`),
    `Revenue,,,${report.grossRevenue.toFixed(2)}`,
    "",
    ...report.expenses.map((e) => `Expense,${e.account_code},"${e.account_name}",${e.total.toFixed(2)}`),
    `Expense,,,${report.totalExpenses.toFixed(2)}`,
    "",
    `Net Income,,,${report.netIncome.toFixed(2)}`,
  ];
  const csv = rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pnl_${report.from}_to_${report.to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main client component ────────────────────────────────────────────────────

interface Props {
  initialPnL: PnLReport;
  initialCashFlow: CashFlowSummary;
  fetchPnL: (from: string, to: string) => Promise<PnLReport>;
  fetchCashFlow: (from: string, to: string) => Promise<CashFlowSummary>;
}

export function ReportsClient({ initialPnL, initialCashFlow, fetchPnL, fetchCashFlow }: Props) {
  const preset = PRESETS[2]; // default: this year
  const [from, setFrom] = useState(initialPnL.from);
  const [to, setTo]     = useState(initialPnL.to);
  const [pnl, setPnl]   = useState(initialPnL);
  const [cash, setCash] = useState(initialCashFlow);
  const [tab, setTab]   = useState<"pnl" | "cash">("pnl");
  const [pending, start] = useTransition();

  function applyPreset(fn: () => { from: string; to: string }) {
    const r = fn();
    setFrom(r.from);
    setTo(r.to);
    runFetch(r.from, r.to);
  }

  function runFetch(f: string, t: string) {
    start(async () => {
      const [p, c] = await Promise.all([fetchPnL(f, t), fetchCashFlow(f, t)]);
      setPnl(p);
      setCash(c);
    });
  }

  return (
    <div className="space-y-6">
      {/* Date range + presets */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={() => runFetch(from, to)}
          disabled={pending}
          className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {pending ? "Loading…" : "Apply"}
        </button>
        <div className="flex items-center gap-2 ml-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.fn)}
              disabled={pending}
              className="text-xs text-slate-600 border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {(["pnl", "cash"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "pnl" ? "Profit & Loss" : "Cash Flow"}
          </button>
        ))}
      </div>

      {/* P&L Report */}
      {tab === "pnl" && (
        <div className={`space-y-6 ${pending ? "opacity-60 pointer-events-none" : ""}`}>
          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Total Revenue" value={pnl.grossRevenue} positive={true} />
            <StatCard label="Total Expenses" value={pnl.totalExpenses} positive={false} />
            <StatCard
              label="Net Income"
              value={pnl.netIncome}
              positive={pnl.netIncome >= 0}
              sub={pnl.netIncome >= 0 ? "Profitable period" : "Net loss"}
            />
          </div>

          {/* Revenue detail */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <h2 className="text-sm font-semibold text-slate-800">Revenue</h2>
              </div>
              <button
                onClick={() => exportPnLCsv(pnl)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
            {pnl.revenue.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No revenue entries in this period</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {pnl.revenue.map((r) => (
                  <div key={r.account_id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <span className="text-xs text-slate-400 mr-2 font-mono">{r.account_code}</span>
                      <span className="text-sm text-slate-700">{r.account_name}</span>
                    </div>
                    <span className="text-sm font-medium text-emerald-600 tabular-nums">{fmt(r.total)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-6 py-3 bg-emerald-50">
                  <span className="text-sm font-semibold text-slate-700">Total Revenue</span>
                  <span className="text-sm font-bold text-emerald-700 tabular-nums">{fmt(pnl.grossRevenue)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Expense detail */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
              <TrendingDown className="w-4 h-4 text-rose-500" />
              <h2 className="text-sm font-semibold text-slate-800">Expenses</h2>
            </div>
            {pnl.expenses.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No expense entries in this period</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {pnl.expenses.map((e) => (
                  <div key={e.account_id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <span className="text-xs text-slate-400 mr-2 font-mono">{e.account_code}</span>
                      <span className="text-sm text-slate-700">{e.account_name}</span>
                    </div>
                    <span className="text-sm font-medium text-rose-600 tabular-nums">{fmt(e.total)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-6 py-3 bg-rose-50">
                  <span className="text-sm font-semibold text-slate-700">Total Expenses</span>
                  <span className="text-sm font-bold text-rose-700 tabular-nums">{fmt(pnl.totalExpenses)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Net income summary row */}
          <div className={`flex items-center justify-between px-6 py-4 rounded-xl border-2 ${
            pnl.netIncome >= 0
              ? "border-emerald-200 bg-emerald-50"
              : "border-rose-200 bg-rose-50"
          }`}>
            <div className="flex items-center gap-2">
              <DollarSign className={`w-5 h-5 ${pnl.netIncome >= 0 ? "text-emerald-600" : "text-rose-600"}`} />
              <span className="text-sm font-semibold text-slate-800">Net Income</span>
              <span className="text-xs text-slate-500">
                {pnl.from} – {pnl.to}
              </span>
            </div>
            <span className={`text-xl font-bold tabular-nums ${pnl.netIncome >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {fmt(pnl.netIncome)}
            </span>
          </div>
        </div>
      )}

      {/* Cash Flow Report */}
      {tab === "cash" && (
        <div className={`space-y-6 ${pending ? "opacity-60 pointer-events-none" : ""}`}>
          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Money In" value={cash.totalIn} positive={true} sub="Deposits & credits" />
            <StatCard label="Money Out" value={cash.totalOut} positive={false} sub="Withdrawals & debits" />
            <StatCard
              label="Net Cash Flow"
              value={cash.net}
              positive={cash.net >= 0}
              sub={cash.net >= 0 ? "Positive flow" : "Negative flow"}
            />
          </div>

          {/* By category */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800">By Category</h2>
            </div>
            {cash.byCategory.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No transactions in this period</p>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_140px_140px] gap-4 px-6 py-2.5 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  <span>Category</span>
                  <span className="text-right">In</span>
                  <span className="text-right">Out</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {cash.byCategory.map((c) => (
                    <div key={c.category} className="grid grid-cols-[1fr_140px_140px] gap-4 px-6 py-3 items-center">
                      <span className="text-sm text-slate-700 truncate">{c.category}</span>
                      <span className="text-sm text-emerald-600 font-medium text-right tabular-nums">
                        {c.totalIn > 0 ? fmt(c.totalIn) : "—"}
                      </span>
                      <span className="text-sm text-rose-600 font-medium text-right tabular-nums">
                        {c.totalOut > 0 ? fmt(c.totalOut) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
