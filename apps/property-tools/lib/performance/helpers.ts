/** Pure helpers for admin performance metrics (unit-tested). */

export function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, x) => sum + x, 0) / values.length;
}

export function minutesBetween(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  const diff = (new Date(b).getTime() - new Date(a).getTime()) / 60000;
  return Number.isFinite(diff) && diff >= 0 ? diff : null;
}

export function rowRevenue(row: { gross_commission?: unknown; recurring_revenue?: unknown }): number {
  const g = Number(row.gross_commission ?? 0);
  const r = Number(row.recurring_revenue ?? 0);
  return (Number.isFinite(g) ? g : 0) + (Number.isFinite(r) ? r : 0);
}

export function isClosedLeadStatus(lead: { lead_status?: unknown; status?: unknown }): boolean {
  const s = String(lead.lead_status ?? lead.status ?? "").toLowerCase();
  return s === "closed" || s === "converted";
}
