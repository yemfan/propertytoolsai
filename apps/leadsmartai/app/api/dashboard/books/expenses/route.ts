import { NextResponse } from "next/server";
import {
  listExpenses,
  createExpense,
  expenseTotals,
  EXPENSE_CATEGORIES,
} from "@/lib/books/expenses";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { userHasCrmFeature, subscriptionRequiredResponse } from "@/lib/billing/subscriptionAccess";

export const runtime = "nodejs";

function monthStart(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
function yearStart(d: Date): string {
  return `${d.getUTCFullYear()}-01-01`;
}

/** Recent expenses + this-month / year-to-date totals for the signed-in agent. */
export async function GET() {
  try {
    const { userId } = await getCurrentAgentContext();
    if (!(await userHasCrmFeature(userId, "bookkeeping"))) {
      return subscriptionRequiredResponse("bookkeeping");
    }
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const [expenses, month, year] = await Promise.all([
      listExpenses({ limit: 200 }),
      expenseTotals({ from: monthStart(now), to: today }),
      expenseTotals({ from: yearStart(now), to: today }),
    ]);
    return NextResponse.json({
      ok: true,
      expenses,
      totals: { month, year },
      categories: EXPENSE_CATEGORIES,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load expenses.";
    console.error("books/expenses GET", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** Log a business expense for the signed-in agent. */
export async function POST(req: Request) {
  try {
    const { userId } = await getCurrentAgentContext();
    if (!(await userHasCrmFeature(userId, "bookkeeping"))) {
      return subscriptionRequiredResponse("bookkeeping");
    }
    const body = (await req.json().catch(() => ({}))) as {
      amount?: number;
      category?: string;
      vendor?: string | null;
      notes?: string | null;
      expenseDate?: string | null;
      receiptUrl?: string | null;
    };
    const result = await createExpense({
      amount: Number(body.amount),
      category: body.category,
      vendor: body.vendor ?? null,
      notes: body.notes ?? null,
      expenseDate: body.expenseDate ?? null,
      receiptUrl: body.receiptUrl ?? null,
    });
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save the expense.";
    console.error("books/expenses POST", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
