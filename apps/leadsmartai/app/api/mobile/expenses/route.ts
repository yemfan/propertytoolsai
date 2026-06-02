import { NextResponse } from "next/server";
import { requireMobileAgent } from "@/lib/mobile/auth";
import {
  listExpensesForAgent,
  createExpenseForAgent,
  expenseTotalsForAgent,
  EXPENSE_CATEGORIES,
  type ExpenseRow,
} from "@/lib/books/expenses";
import type { MobileExpenseDto } from "@leadsmart/shared";

export const runtime = "nodejs";

function monthStart(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
function yearStart(d: Date): string {
  return `${d.getUTCFullYear()}-01-01`;
}

function toDto(r: ExpenseRow): MobileExpenseDto {
  return {
    id: String(r.id),
    expense_date: r.expense_date,
    amount: Number(r.amount),
    category: r.category,
    vendor: r.vendor,
    notes: r.notes,
    receipt_url: r.receipt_url,
    created_at: r.created_at,
  };
}

/** Recent expenses + this-month / YTD totals for the authenticated agent. */
export async function GET(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const agentId = auth.ctx.agentId;
    const [expenses, month, year] = await Promise.all([
      listExpensesForAgent(agentId, { limit: 200 }),
      expenseTotalsForAgent(agentId, { from: monthStart(now), to: today }),
      expenseTotalsForAgent(agentId, { from: yearStart(now), to: today }),
    ]);
    return NextResponse.json({
      ok: true,
      success: true,
      expenses: expenses.map(toDto),
      totals: { month, year },
      categories: EXPENSE_CATEGORIES,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/mobile/expenses", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}

type PostBody = {
  amount?: number;
  category?: string;
  vendor?: string | null;
  notes?: string | null;
  expenseDate?: string | null;
  receiptUrl?: string | null;
};

/** Log a business expense for the authenticated agent. */
export async function POST(req: Request) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as PostBody;
    const result = await createExpenseForAgent(auth.ctx.agentId, {
      amount: Number(body.amount),
      category: body.category,
      vendor: body.vendor ?? null,
      notes: body.notes ?? null,
      expenseDate: body.expenseDate ?? null,
      receiptUrl: body.receiptUrl ?? null,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, success: true, id: result.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/mobile/expenses", e);
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 });
  }
}
