import { NextResponse } from "next/server";
import {
  buildWeeklyMrrSeries,
  clampIntDays,
  computeCurrentMrr,
  computeMrrByPlan,
  daysAgoIso,
  fetchSubscriptionEventsForMrrSeries,
} from "@/lib/analytics/saasMetrics";
import { requireRoleRoute } from "@/lib/auth/requireRole";

/**
 * GET — MRR (authoritative from billing_subscriptions), by-plan split, weekly series from subscription_events.
 * Query: `weeks` (default 12, max 52), `seriesDays` — how far back to load events for reconstruction (default 400).
 */
export async function GET(req: Request) {
  try {
    const auth = await requireRoleRoute(["admin"], { strictUnauthorized: true });
    if (auth.ok === false) return auth.response;

    const { searchParams } = new URL(req.url);
    const weeks = clampIntDays(searchParams.get("weeks"), 12, 52);
    const seriesDays = clampIntDays(searchParams.get("seriesDays"), 400, 800);

    const sinceSeries = daysAgoIso(seriesDays);
    const [{ mrr, payingRowCount }, byPlan, events] = await Promise.all([
      computeCurrentMrr(),
      computeMrrByPlan(),
      fetchSubscriptionEventsForMrrSeries(sinceSeries),
    ]);

    const weeklyFromEvents = buildWeeklyMrrSeries(events, weeks);
    const seriesNote =
      events.length >= 10_000
        ? "Event cap reached (10k rows); extend seriesDays or archive old subscription_events for long-range accuracy."
        : weeklyFromEvents.every((p) => p.mrr === 0) && mrr > 0
          ? "Weekly MRR from events is flat at 0 until Stripe sync writes subscription_events with stripe_subscription_id (deploy migrations + webhooks)."
          : null;

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      currentMrr: mrr,
      payingSubscriptions: payingRowCount,
      mrrByPlan: byPlan,
      weeklyMrrFromEvents: weeklyFromEvents,
      seriesNote,
      definitions: {
        currentMrr:
          "Sum of billing_subscriptions.amount_monthly where status is active or trialing (canonical).",
        weeklyMrrFromEvents:
          "Replay of subscription_events (billing_updated / billing_inactive / subscription_canceled) per Stripe subscription id — approximate until history is dense.",
      },
    });
  } catch (e) {
    console.error("[admin/metrics/revenue]", e);
    return NextResponse.json({ success: false, error: "Failed to load revenue metrics" }, { status: 500 });
  }
}
