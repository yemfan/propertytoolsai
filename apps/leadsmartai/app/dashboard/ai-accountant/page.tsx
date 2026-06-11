import type { Metadata } from "next";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { listInvoices } from "@/lib/books/invoices";
import { expenseTotalsForAgent, listExpensesForAgent } from "@/lib/books/expenses";
import { listTransactionsForAgent } from "@/lib/transactions/service";
import AccountantClient from "./AccountantClient";

export const metadata: Metadata = {
  title: "AI Accountant",
  description: "Invoices, expenses, and your commission pipeline — your AI Accountant gets you paid faster.",
  robots: { index: false },
};

/**
 * AI Accountant — fifth member of the AI team (modeled on HelmSmart's
 * Alex, the AI Finance Director). Owns the money features: invoices
 * (Books), expenses, and the commission pipeline. Server-composed from
 * the same service layer Books uses — no new queries to maintain.
 */
export default async function AiAccountantPage() {
  const { agentId } = await getCurrentAgentContext();

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartIso = monthStart.toISOString().slice(0, 10);

  const [invoices, expenseTotals, recentExpenses, transactions] = await Promise.all([
    listInvoices(50),
    expenseTotalsForAgent(agentId, { from: monthStartIso }),
    listExpensesForAgent(agentId, { limit: 6 }),
    listTransactionsForAgent(String(agentId)).catch(() => []),
  ]);

  // Commission pipeline: expected net (fall back to gross) across
  // active + pending deals — same fields the revenue/forecast services read.
  const pipeline = transactions
    .filter((t) => t.status === "active" || t.status === "pending")
    .reduce((sum, t) => sum + (t.agent_net_commission ?? t.gross_commission ?? 0), 0);

  return (
    <AccountantClient
      invoices={invoices.map((i) => ({
        id: i.id,
        invoice_number: i.invoice_number,
        client_name: i.client_name,
        status: i.status,
        due_date: i.due_date,
        total: i.total,
      }))}
      expensesMonthTotal={expenseTotals.total ?? 0}
      expensesByCategory={expenseTotals.byCategory ?? []}
      recentExpenses={recentExpenses.map((e) => ({
        id: e.id,
        expense_date: e.expense_date,
        amount: e.amount,
        category: e.category,
        vendor: e.vendor,
      }))}
      commissionPipeline={pipeline}
      activeDeals={transactions.filter((t) => t.status === "active" || t.status === "pending").length}
    />
  );
}
