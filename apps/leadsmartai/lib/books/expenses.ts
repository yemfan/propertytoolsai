import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { round2 } from "./money";
import { EXPENSE_CATEGORIES, type ExpenseCategory, normalizeCategory } from "./expense-categories";

export { EXPENSE_CATEGORIES, normalizeCategory };
export type { ExpenseCategory };

/**
 * Expense service for the LeadSmart "Books" feature. A realtor's income is
 * commission, so their bookkeeping pain is logging business COSTS for taxes —
 * marketing, mileage, MLS/NAR dues, signage, staging, client gifts, CE.
 *
 * Core fns take an explicit agentId so they can be shared by the web dashboard
 * (cookie auth via getCurrentAgentContext) and the mobile app (Bearer-token
 * auth via requireMobileAgent). Thin wrappers resolve the agent from cookies.
 * All access goes through supabaseAdmin filtered by agent_id (no RLS on the
 * expenses table).
 */

export type ExpenseRow = {
  id: string;
  agent_id: number | string;
  expense_date: string;
  amount: number;
  category: string;
  vendor: string | null;
  notes: string | null;
  receipt_url: string | null;
  created_at: string;
};

export type CreateExpenseInput = {
  amount: number;
  category?: string;
  vendor?: string | null;
  notes?: string | null;
  /** YYYY-MM-DD; defaults to today (server date) when omitted. */
  expenseDate?: string | null;
  receiptUrl?: string | null;
};

export type ExpenseListOptions = {
  /** Inclusive YYYY-MM-DD lower bound on expense_date. */
  from?: string | null;
  /** Inclusive YYYY-MM-DD upper bound on expense_date. */
  to?: string | null;
  limit?: number;
};

export type CategoryTotal = { category: string; total: number; count: number };

export type ExpenseTotals = {
  total: number;
  count: number;
  byCategory: CategoryTotal[];
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function cleanDate(value: unknown): string | null {
  const s = String(value ?? "").trim().slice(0, 10);
  return ISO_DATE.test(s) ? s : null;
}

// ---------------------------------------------------------------------------
// Agent-scoped core (shared by web + mobile)
// ---------------------------------------------------------------------------

export async function listExpensesForAgent(
  agentId: string | number,
  opts: ExpenseListOptions = {},
): Promise<ExpenseRow[]> {
  let q = supabaseAdmin
    .from("expenses")
    .select("*")
    .eq("agent_id", agentId as never)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(Number(opts.limit) || 200, 1), 500));
  const from = cleanDate(opts.from);
  const to = cleanDate(opts.to);
  if (from) q = q.gte("expense_date", from);
  if (to) q = q.lte("expense_date", to);
  const { data, error } = await q;
  if (error) {
    console.error("[books] listExpensesForAgent:", error.message);
    return [];
  }
  return (data ?? []) as unknown as ExpenseRow[];
}

export async function createExpenseForAgent(
  agentId: string | number,
  input: CreateExpenseInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const amount = round2(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter an amount greater than zero." };
  }
  const row = {
    agent_id: agentId,
    amount,
    category: normalizeCategory(input.category),
    vendor: input.vendor?.toString().trim() || null,
    notes: input.notes?.toString().trim() || null,
    expense_date: cleanDate(input.expenseDate) || todayIso(),
    receipt_url: input.receiptUrl?.toString().trim() || null,
  };
  const { data, error } = await supabaseAdmin
    .from("expenses")
    .insert(row as never)
    .select("id")
    .single();
  if (error || !data) {
    console.error("[books] createExpenseForAgent:", error?.message);
    return { ok: false, error: error?.message || "Could not save the expense." };
  }
  return { ok: true, id: String((data as { id: unknown }).id) };
}

export async function deleteExpenseForAgent(
  agentId: string | number,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("agent_id", agentId as never);
  if (error) {
    console.error("[books] deleteExpenseForAgent:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Sum expenses for an agent, grouped by category (newest categories first by
 *  total). Optionally bounded by a date window (e.g. this month / YTD). */
export async function expenseTotalsForAgent(
  agentId: string | number,
  opts: { from?: string | null; to?: string | null } = {},
): Promise<ExpenseTotals> {
  let q = supabaseAdmin
    .from("expenses")
    .select("amount, category")
    .eq("agent_id", agentId as never);
  const from = cleanDate(opts.from);
  const to = cleanDate(opts.to);
  if (from) q = q.gte("expense_date", from);
  if (to) q = q.lte("expense_date", to);
  const { data, error } = await q;
  if (error) {
    console.error("[books] expenseTotalsForAgent:", error.message);
    return { total: 0, count: 0, byCategory: [] };
  }
  const rows = (data ?? []) as unknown as { amount: number; category: string }[];
  const map = new Map<string, { total: number; count: number }>();
  let total = 0;
  for (const r of rows) {
    const amt = Number(r.amount) || 0;
    total += amt;
    const cat = normalizeCategory(r.category);
    const cur = map.get(cat) ?? { total: 0, count: 0 };
    cur.total += amt;
    cur.count += 1;
    map.set(cat, cur);
  }
  const byCategory = [...map.entries()]
    .map(([category, v]) => ({ category, total: round2(v.total), count: v.count }))
    .sort((a, b) => b.total - a.total);
  return { total: round2(total), count: rows.length, byCategory };
}

// ---------------------------------------------------------------------------
// Cookie-scoped wrappers (web dashboard)
// ---------------------------------------------------------------------------

export async function listExpenses(opts: ExpenseListOptions = {}): Promise<ExpenseRow[]> {
  const { agentId } = await getCurrentAgentContext();
  return listExpensesForAgent(agentId, opts);
}

export async function createExpense(input: CreateExpenseInput) {
  const { agentId } = await getCurrentAgentContext();
  return createExpenseForAgent(agentId, input);
}

export async function deleteExpense(id: string) {
  const { agentId } = await getCurrentAgentContext();
  return deleteExpenseForAgent(agentId, id);
}

export async function expenseTotals(opts: { from?: string | null; to?: string | null } = {}) {
  const { agentId } = await getCurrentAgentContext();
  return expenseTotalsForAgent(agentId, opts);
}
