import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { TransactionRow } from "@/lib/transactions/types";

/**
 * Revenue + commission analytics for /dashboard/performance.
 *
 * Keeps the aggregations in-memory so we don't need a materialized
 * view. Volume per agent is tens of transactions per year — fine to
 * pull raw rows and reduce.
 *
 * Period semantics:
 *   * "ytd"  — year-to-date, Jan 1 00:00:00 of current UTC year.
 *   * "12m"  — trailing 365 days.
 *   * "all"  — no date filter.
 *
 * A transaction counts as "closed" when status='closed' AND
 * closing_date_actual is set. Scheduled close_date alone isn't enough
 * — that's forecast, not revenue.
 */

export type RevenuePeriod = "ytd" | "12m" | "all";

export type ClosedTransactionSummary = {
  id: string;
  property_address: string;
  contact_id: string;
  contact_name: string | null;
  transaction_type: TransactionRow["transaction_type"];
  purchase_price: number | null;
  commission_pct: number | null;
  gross_commission: number | null;
  agent_net_commission: number | null;
  mutual_acceptance_date: string | null;
  closing_date_actual: string | null;
  days_to_close: number | null;
};

export type MonthlyRevenueBucket = {
  month: string; // "2026-04"
  label: string; // "Apr 26"
  closedCount: number;
  grossCommission: number;
  netCommission: number;
};

export type RevenueSummary = {
  period: RevenuePeriod;

  // Closed deals
  closedCount: number;
  grossCommission: number;
  netCommission: number;

  // Pipeline — active transactions (not yet closed) with expected commission
  activePipelineCount: number;
  expectedGrossFromActive: number;

  // Offer conversion
  offersSubmitted: number;
  offersAccepted: number;
  offersLost: number;
  closeRatePct: number | null; // accepted / (accepted + lost) × 100

  // Time
  avgDaysToClose: number | null;

  byMonth: MonthlyRevenueBucket[];
  closedDeals: ClosedTransactionSummary[];
};

export async function getRevenueSummary(
  agentId: string,
  period: RevenuePeriod = "ytd",
): Promise<RevenueSummary> {
  const periodStartIso = periodStart(period);

  // All transactions for this agent (we partition in-memory based on status +
  // period). Volume is small per agent; fine to fetch all and filter.
  const { data: txRows, error: txErr } = await supabaseAdmin
    .from("transactions")
    .select(
      "id, contact_id, transaction_type, property_address, status, purchase_price, commission_pct, gross_commission, agent_net_commission, mutual_acceptance_date, closing_date, closing_date_actual, created_at",
    )
    .eq("agent_id", agentId);
  if (txErr) throw new Error(txErr.message);
  const transactions = (txRows ?? []) as Array<
    Pick<
      TransactionRow,
      | "id"
      | "contact_id"
      | "transaction_type"
      | "property_address"
      | "status"
      | "purchase_price"
      | "commission_pct"
      | "gross_commission"
      | "agent_net_commission"
      | "mutual_acceptance_date"
      | "closing_date"
      | "closing_date_actual"
      | "created_at"
    >
  >;

  // Partition into closed + active.
  const closed: typeof transactions = [];
  const active: typeof transactions = [];
  for (const t of transactions) {
    if (t.status === "closed" && t.closing_date_actual) {
      if (!periodStartIso || t.closing_date_actual >= periodStartIso) closed.push(t);
    } else if (t.status === "active" || t.status === "pending") {
      active.push(t);
    }
  }

  // Contact names — one bulk query.
  const contactIds = [...new Set([...closed, ...active].map((t) => t.contact_id))];
  const contactNameById = new Map<string, string | null>();
  if (contactIds.length) {
    const { data: contactRows } = await supabaseAdmin
      .from("contacts")
      .select("id, first_name, last_name, name, email")
      .in("id", contactIds);
    for (const c of (contactRows ?? []) as Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      name: string | null;
      email: string | null;
    }>) {
      const joined = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
      contactNameById.set(c.id, joined || c.name || c.email || null);
    }
  }

  // Offer stats — separate query, also scoped to the period.
  const { data: offerRows } = await supabaseAdmin
    .from("offers")
    .select("id, status, submitted_at, accepted_at, closed_at")
    .eq("agent_id", agentId);
  const offers = (offerRows ?? []) as Array<{
    id: string;
    status: string;
    submitted_at: string | null;
    accepted_at: string | null;
    closed_at: string | null;
  }>;

  let offersSubmitted = 0;
  let offersAccepted = 0;
  let offersLost = 0;
  for (const o of offers) {
    // An offer "counts" for this period if the terminal event happened in the window.
    const anchor = o.accepted_at ?? o.closed_at ?? o.submitted_at;
    if (periodStartIso && (!anchor || anchor < periodStartIso)) continue;
    if (o.submitted_at) offersSubmitted += 1;
    if (o.status === "accepted") offersAccepted += 1;
    if (["rejected", "withdrawn", "expired"].includes(o.status)) offersLost += 1;
  }
  const closedRateDenom = offersAccepted + offersLost;
  const closeRatePct = closedRateDenom > 0 ? Math.round((offersAccepted / closedRateDenom) * 100) : null;

  // Aggregations over closed.
  let grossCommission = 0;
  let netCommission = 0;
  let daysSum = 0;
  let daysCount = 0;
  const byMonth = new Map<string, MonthlyRevenueBucket>();
  const closedDeals: ClosedTransactionSummary[] = [];

  for (const t of closed) {
    const gross = t.gross_commission ?? 0;
    const net = t.agent_net_commission ?? 0;
    grossCommission += gross;
    netCommission += net;

    const daysToClose = daysBetween(t.mutual_acceptance_date, t.closing_date_actual);
    if (daysToClose != null) {
      daysSum += daysToClose;
      daysCount += 1;
    }

    const monthKey = t.closing_date_actual!.slice(0, 7); // "YYYY-MM"
    const bucket = byMonth.get(monthKey) ?? {
      month: monthKey,
      label: formatMonthLabel(monthKey),
      closedCount: 0,
      grossCommission: 0,
      netCommission: 0,
    };
    bucket.closedCount += 1;
    bucket.grossCommission += gross;
    bucket.netCommission += net;
    byMonth.set(monthKey, bucket);

    closedDeals.push({
      id: t.id,
      property_address: t.property_address,
      contact_id: t.contact_id,
      contact_name: contactNameById.get(t.contact_id) ?? null,
      transaction_type: t.transaction_type,
      purchase_price: t.purchase_price,
      commission_pct: t.commission_pct,
      gross_commission: t.gross_commission,
      agent_net_commission: t.agent_net_commission,
      mutual_acceptance_date: t.mutual_acceptance_date,
      closing_date_actual: t.closing_date_actual,
      days_to_close: daysToClose,
    });
  }

  // Sort closed deals most-recent first.
  closedDeals.sort((a, b) => {
    const aDate = a.closing_date_actual ?? "";
    const bDate = b.closing_date_actual ?? "";
    return aDate < bDate ? 1 : aDate > bDate ? -1 : 0;
  });

  // Active pipeline (doesn't respect period — it's about what's on deck NOW).
  let expectedGrossFromActive = 0;
  for (const t of active) {
    expectedGrossFromActive += t.gross_commission ?? 0;
  }

  return {
    period,
    closedCount: closed.length,
    grossCommission: round2(grossCommission),
    netCommission: round2(netCommission),
    activePipelineCount: active.length,
    expectedGrossFromActive: round2(expectedGrossFromActive),
    offersSubmitted,
    offersAccepted,
    offersLost,
    closeRatePct,
    avgDaysToClose: daysCount > 0 ? Math.round(daysSum / daysCount) : null,
    byMonth: sortMonths([...byMonth.values()]),
    closedDeals,
  };
}

/**
 * CSV export of closed deals for the period — feeds the agent's
 * spreadsheet / accountant tax-prep workflow. Deliberately a flat,
 * Excel-friendly column order.
 */
export function buildClosedDealsCsv(deals: ClosedTransactionSummary[]): string {
  const header = [
    "Property",
    "Buyer/Seller",
    "Type",
    "Mutual Acceptance",
    "Closing Date",
    "Days to Close",
    "Purchase Price",
    "Commission %",
    "Gross Commission",
    "Agent Net Commission",
  ];
  const lines = [header.map(csvField).join(",")];
  for (const d of deals) {
    lines.push(
      [
        d.property_address,
        d.contact_name ?? "",
        d.transaction_type,
        d.mutual_acceptance_date ?? "",
        d.closing_date_actual ?? "",
        d.days_to_close ?? "",
        d.purchase_price ?? "",
        d.commission_pct ?? "",
        d.gross_commission ?? "",
        d.agent_net_commission ?? "",
      ]
        .map(csvField)
        .join(","),
    );
  }
  return lines.join("\n");
}

function csvField(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function periodStart(period: RevenuePeriod): string | null {
  if (period === "all") return null;
  if (period === "ytd") {
    const y = new Date().getUTCFullYear();
    return `${y}-01-01`;
  }
  // "12m"
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 365);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string | null, toIso: string | null): number | null {
  if (!fromIso || !toIso) return null;
  const [fy, fm, fd] = fromIso.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = toIso.slice(0, 10).split("-").map(Number);
  const from = Date.UTC(fy, (fm ?? 1) - 1, fd ?? 1);
  const to = Date.UTC(ty, (tm ?? 1) - 1, td ?? 1);
  return Math.round((to - from) / 86_400_000);
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

function sortMonths(buckets: MonthlyRevenueBucket[]): MonthlyRevenueBucket[] {
  return [...buckets].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
