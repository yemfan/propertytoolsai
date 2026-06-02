// Pure financial-report aggregation cores. No I/O: the caller fetches + normalizes
// rows (org scope, date filter, CoA join), then hands them here. These encode the
// domain math — the cash-basis P&L sign convention and AR aging buckets — so every
// app and industry pack reports the numbers identically.

// ─── Profit & Loss ─────────────────────────────────────────────────────────────

/** A normalized journal line for P&L aggregation (revenue/expense accounts only). */
export interface PnLJournalLine {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: "revenue" | "expense";
  debit: number;
  credit: number;
}

export interface PnLRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: "revenue" | "expense";
  total: number;
}

export interface PnLReport {
  from: string;
  to: string;
  revenue: PnLRow[];
  expenses: PnLRow[];
  grossRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

/**
 * Aggregate normalized journal lines into a cash-basis P&L.
 *
 * Sign convention:
 *   revenue accounts (normal balance = credit) → total = credit − debit
 *   expense accounts (normal balance = debit)  → total = debit − credit
 * so a positive total always means "earned" (revenue) or "spent" (expense).
 */
export function aggregatePnL(lines: PnLJournalLine[], from: string, to: string): PnLReport {
  const map = new Map<string, PnLRow & { debitSum: number; creditSum: number }>();

  for (const line of lines) {
    if (line.account_type !== "revenue" && line.account_type !== "expense") continue;
    const existing = map.get(line.account_id) ?? {
      account_id: line.account_id,
      account_code: line.account_code,
      account_name: line.account_name,
      account_type: line.account_type,
      total: 0,
      debitSum: 0,
      creditSum: 0,
    };
    existing.debitSum += Number(line.debit) || 0;
    existing.creditSum += Number(line.credit) || 0;
    map.set(line.account_id, existing);
  }

  const revenue: PnLRow[] = [];
  const expenses: PnLRow[] = [];

  for (const row of map.values()) {
    if (row.account_type === "revenue") {
      row.total = row.creditSum - row.debitSum;
      revenue.push(strip(row));
    } else {
      row.total = row.debitSum - row.creditSum;
      expenses.push(strip(row));
    }
  }

  revenue.sort((a, b) => b.total - a.total);
  expenses.sort((a, b) => b.total - a.total);

  const grossRevenue = revenue.reduce((s, r) => s + r.total, 0);
  const totalExpenses = expenses.reduce((s, r) => s + r.total, 0);

  return { from, to, revenue, expenses, grossRevenue, totalExpenses, netIncome: grossRevenue - totalExpenses };
}

function strip(row: PnLRow & { debitSum: number; creditSum: number }): PnLRow {
  return {
    account_id: row.account_id,
    account_code: row.account_code,
    account_name: row.account_name,
    account_type: row.account_type,
    total: row.total,
  };
}

// ─── Accounts-receivable aging ──────────────────────────────────────────────────

export type AgingBucket = "current" | "d1_30" | "d31_60" | "d61_90" | "d90_plus";

const DAY_MS = 86_400_000;

/** Whole days a due date (YYYY-MM-DD) is past an as-of date (YYYY-MM-DD). */
export function daysPastDue(dueDate: string, asOf: string): number {
  const due = new Date(dueDate + "T00:00:00").getTime();
  const ref = new Date(asOf + "T00:00:00").getTime();
  return Math.floor((ref - due) / DAY_MS);
}

/** Classify an unpaid invoice into an aging bucket by how overdue it is. */
export function agingBucket(daysPast: number): AgingBucket {
  if (daysPast <= 0) return "current";
  if (daysPast <= 30) return "d1_30";
  if (daysPast <= 60) return "d31_60";
  if (daysPast <= 90) return "d61_90";
  return "d90_plus";
}
