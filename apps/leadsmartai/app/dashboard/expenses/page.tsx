import type { Metadata } from "next";
import { listExpenses, expenseTotals } from "@/lib/books/expenses";
import ExpensesClient from "@/components/dashboard/ExpensesClient";

export const metadata: Metadata = {
  title: "Expenses",
  description: "Track your real estate business costs for tax time — marketing, mileage, dues, and more.",
  robots: { index: false },
};

function monthStart(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
function yearStart(d: Date): string {
  return `${d.getUTCFullYear()}-01-01`;
}

/**
 * Expenses — realtor business-cost tracking for bookkeeping/taxes. A realtor's
 * income is commission, so the bookkeeping pain is logging COSTS, not billing
 * clients. Server component loads recent expenses + this-month / YTD totals.
 */
export default async function ExpensesPage() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const [expenses, month, year] = await Promise.all([
    listExpenses({ limit: 200 }),
    expenseTotals({ from: monthStart(now), to: today }),
    expenseTotals({ from: yearStart(now), to: today }),
  ]);
  return (
    <ExpensesClient
      initialExpenses={expenses}
      monthTotals={month}
      yearTotals={year}
    />
  );
}
