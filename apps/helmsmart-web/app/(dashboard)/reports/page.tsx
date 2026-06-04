import { ResponsibleEmployee } from "@/components/responsible-employee";
import type { Metadata } from "next";
import { getPnLReport, getCashFlowSummary, getTimeReport, getReceivablesAging, getCashFlowForecast, getSalesTaxReport } from "@/lib/actions/reports";
import { listProjectsPnL, listClientsPnL } from "@/lib/actions/projects";
import { ReportsClient } from "./reports-client";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  // Default: current calendar year
  const y = new Date().getFullYear();
  const from = `${y}-01-01`;
  const to   = `${y}-12-31`;

  const [pnl, cashFlow, timeReport, projects, clients, receivables, forecast, salesTax] = await Promise.all([
    getPnLReport(from, to),
    getCashFlowSummary(from, to),
    getTimeReport(from, to),
    listProjectsPnL(),
    listClientsPnL(),
    getReceivablesAging(),
    getCashFlowForecast(),
    getSalesTaxReport(from, to),
  ]);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <ResponsibleEmployee slug="tim" className="mb-3" />
        <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Profit & loss, cash flow, time tracking, and receivables aging
        </p>
      </div>

      <ReportsClient
        initialTab={tab}
        initialPnL={pnl}
        initialCashFlow={cashFlow}
        initialTimeReport={timeReport}
        initialProjects={projects}
        initialClients={clients}
        initialReceivables={receivables}
        initialForecast={forecast}
        initialSalesTax={salesTax}
        fetchPnL={getPnLReport}
        fetchCashFlow={getCashFlowSummary}
        fetchTimeReport={getTimeReport}
        fetchSalesTax={getSalesTaxReport}
      />
    </div>
  );
}
