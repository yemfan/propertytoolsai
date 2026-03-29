import { NextResponse } from "next/server";
import {
  clampIntDays,
  computeActivationRate,
  computeCheckoutConversionRate,
  computeChurnMetrics,
  computeCurrentMrr,
  countDistinctPayingUsers,
  countMauUsage,
  countNewPayingEvents,
  daysAgoIso,
} from "@/lib/analytics/saasMetrics";
import { requireRoleRoute } from "@/lib/auth/requireRole";

/**
 * GET — founder metrics snapshot (MRR, MAU, activation, conversion, churn).
 * Query: `days` (usage + funnel conversion window, default 30), `churnDays` (default 30, max 90).
 */
export async function GET(req: Request) {
  try {
    const auth = await requireRoleRoute(["admin"], { strictUnauthorized: true });
    if (auth.ok === false) return auth.response;

    const { searchParams } = new URL(req.url);
    const usageDays = clampIntDays(searchParams.get("days"), 30);
    const churnDays = clampIntDays(searchParams.get("churnDays"), 30, 90);
    const sinceUsage = daysAgoIso(usageDays);

    const [{ mrr, payingRowCount }, payingUsersDistinct, mauUsage, activation, conversion, churn, newPaying] =
      await Promise.all([
        computeCurrentMrr(),
        countDistinctPayingUsers(),
        countMauUsage(sinceUsage),
        computeActivationRate(),
        computeCheckoutConversionRate(sinceUsage),
        computeChurnMetrics(churnDays),
        countNewPayingEvents(sinceUsage),
      ]);

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      scope: {
        usageAndConversionWindowDays: usageDays,
        churnWindowDays: churnDays,
      },
      mrr,
      payingSubscriptions: payingRowCount,
      payingUsersDistinct,
      mauUsage,
      activation: {
        onboarded: activation.onboarded,
        activatedWithin7dOfOnboarding: activation.activatedWithin7d,
        rate: activation.rate,
        definition:
          "Users with first_reply_at within 7 days after onboarding_completed_at / users with onboarding completed",
      },
      conversion: {
        checkoutStartedUsers: conversion.checkoutStartedUsers,
        convertedUsers: conversion.convertedUsers,
        rate: conversion.rate,
        definition:
          "Distinct users with subscription_active_crm in window who also had upgrade_checkout_started in the same window / distinct checkout starters in window",
      },
      churn: {
        churnedUsers: churn.churnedUsers,
        payingUsersNow: churn.payingUsersNow,
        rate: churn.churnRate,
        definition: churn.definition,
      },
      newPayingUsersInWindow: newPaying,
    });
  } catch (e) {
    console.error("[admin/metrics/overview]", e);
    return NextResponse.json({ success: false, error: "Failed to load overview metrics" }, { status: 500 });
  }
}
