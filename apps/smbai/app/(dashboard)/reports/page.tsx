import type { Metadata } from "next";
import { getPnLReport, getCashFlowSummary } from "@/lib/actions/reports";
import { ReportsClient } from "./reports-client";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  // Default: current calendar year
  const y = new Date().getFullYear();
  const from = `${y}-01-01`;
  const to   = `${y}-12-31`;

  const [pnl, cashFlow] = await Promise.all([
    getPnLReport(from, to),
    getCashFlowSummary(from, to),
  ]);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Profit & Loss and cash flow across any date range
        </p>
      </div>

      <ReportsClient
        initialPnL={pnl}
        initialCashFlow={cashFlow}
        fetchPnL={getPnLReport}
        fetchCashFlow={getCashFlowSummary}
      />
    </div>
  );
}
