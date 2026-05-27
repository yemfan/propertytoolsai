"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export interface PnLRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: "revenue" | "expense";
  total: number;         // positive = money in (revenue), positive = money spent (expense)
}

export interface PnLReport {
  from: string;          // YYYY-MM-DD
  to: string;            // YYYY-MM-DD
  revenue: PnLRow[];
  expenses: PnLRow[];
  grossRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

// ─── Profit & Loss ────────────────────────────────────────────────────────────

export async function getPnLReport(from: string, to: string): Promise<PnLReport> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value ?? "";
  if (!orgId) throw new Error("Not authenticated");

  const supabase = await createClient();

  // Pull all journal lines within the date range, with CoA info
  const { data, error } = await supabase
    .from("journal_lines")
    .select(`
      debit,
      credit,
      account_id,
      chart_of_accounts!inner (
        code,
        name,
        type,
        normal_balance,
        organization_id
      ),
      journal_entries!inner (
        date,
        organization_id
      )
    `)
    .eq("chart_of_accounts.organization_id", orgId)
    .eq("journal_entries.organization_id", orgId)
    .gte("journal_entries.date", from)
    .lte("journal_entries.date", to);

  if (error) throw new Error(error.message);

  // Aggregate by account
  const accountMap = new Map<string, PnLRow & { debitSum: number; creditSum: number }>();

  for (const line of data ?? []) {
    const coaRaw = line.chart_of_accounts as unknown as
      | { code: string; name: string; type: string; normal_balance: string }
      | { code: string; name: string; type: string; normal_balance: string }[];
    const coa = Array.isArray(coaRaw) ? coaRaw[0] : coaRaw;
    if (!coa) continue;
    if (coa.type !== "revenue" && coa.type !== "expense") continue;

    const key = line.account_id;
    const existing = accountMap.get(key) ?? {
      account_id: line.account_id,
      account_code: coa.code,
      account_name: coa.name,
      account_type: coa.type as "revenue" | "expense",
      total: 0,
      debitSum: 0,
      creditSum: 0,
    };
    existing.debitSum += Number(line.debit);
    existing.creditSum += Number(line.credit);
    accountMap.set(key, existing);
  }

  // Cash-basis P&L sign convention:
  //   Revenue accounts: normal balance = credit → net = credit - debit (positive = revenue earned)
  //   Expense accounts: normal balance = debit  → net = debit - credit (positive = expense incurred)
  const revenue: PnLRow[] = [];
  const expenses: PnLRow[] = [];

  for (const [, row] of accountMap) {
    if (row.account_type === "revenue") {
      row.total = row.creditSum - row.debitSum;
      revenue.push({ account_id: row.account_id, account_code: row.account_code, account_name: row.account_name, account_type: "revenue", total: row.total });
    } else {
      row.total = row.debitSum - row.creditSum;
      expenses.push({ account_id: row.account_id, account_code: row.account_code, account_name: row.account_name, account_type: "expense", total: row.total });
    }
  }

  revenue.sort((a, b) => b.total - a.total);
  expenses.sort((a, b) => b.total - a.total);

  const grossRevenue = revenue.reduce((s, r) => s + r.total, 0);
  const totalExpenses = expenses.reduce((s, r) => s + r.total, 0);
  const netIncome = grossRevenue - totalExpenses;

  return { from, to, revenue, expenses, grossRevenue, totalExpenses, netIncome };
}

// ─── Cash flow summary (bank transactions) ────────────────────────────────────

export interface CashFlowSummary {
  from: string;
  to: string;
  totalIn: number;
  totalOut: number;
  net: number;
  byCategory: { category: string; totalIn: number; totalOut: number }[];
}

export async function getCashFlowSummary(from: string, to: string): Promise<CashFlowSummary> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value ?? "";
  if (!orgId) throw new Error("Not authenticated");

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bank_transactions")
    .select("amount, category")
    .eq("organization_id", orgId)
    .gte("date", from)
    .lte("date", to)
    .eq("excluded", false);

  if (error) throw new Error(error.message);

  // Plaid sign convention: negative = money in, positive = money out
  let totalIn = 0;
  let totalOut = 0;
  const catMap = new Map<string, { totalIn: number; totalOut: number }>();

  for (const tx of data ?? []) {
    const amt = Number(tx.amount);
    const cat = tx.category ?? "Uncategorized";
    const cur = catMap.get(cat) ?? { totalIn: 0, totalOut: 0 };

    if (amt < 0) {
      totalIn += Math.abs(amt);
      cur.totalIn += Math.abs(amt);
    } else {
      totalOut += amt;
      cur.totalOut += amt;
    }
    catMap.set(cat, cur);
  }

  const byCategory = Array.from(catMap.entries())
    .map(([category, vals]) => ({ category, ...vals }))
    .sort((a, b) => (b.totalIn + b.totalOut) - (a.totalIn + a.totalOut));

  return { from, to, totalIn, totalOut, net: totalIn - totalOut, byCategory };
}
