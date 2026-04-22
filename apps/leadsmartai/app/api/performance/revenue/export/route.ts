import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  buildClosedDealsCsv,
  getRevenueSummary,
  type RevenuePeriod,
} from "@/lib/performance/revenueService";

export const runtime = "nodejs";

/**
 * GET /api/performance/revenue/export?period=ytd|12m|all
 *
 * Returns a CSV of closed deals for the period. Hooked up to the
 * "Download CSV" button on the Performance page.
 */
export async function GET(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const url = new URL(req.url);
    const rawPeriod = url.searchParams.get("period");
    const period: RevenuePeriod =
      rawPeriod === "12m" || rawPeriod === "all" ? rawPeriod : "ytd";

    const summary = await getRevenueSummary(String(agentId), period);
    const csv = buildClosedDealsCsv(summary.closedDeals);
    const filename = `closed-deals-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/performance/revenue/export:", err);
    return new Response(message, { status: 500 });
  }
}
