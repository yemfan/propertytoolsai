import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { getActiveCrmSubscription } from "@/lib/billing/subscriptionAccess";
import { getCrmStripePriceId } from "@/lib/billing/crmStripePrices";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { BillingCadence } from "@/lib/billing/plans";

export const runtime = "nodejs";

type Body = {
  cadence: BillingCadence;
};

function isBillingCadence(v: unknown): v is BillingCadence {
  return v === "monthly" || v === "annual";
}

/**
 * POST /api/billing/crm/change-cadence
 *
 * Switches the user's current CRM subscription between monthly and
 * annual billing on the SAME tier. Per the v2.0 spec's cadence rules:
 *
 *   - Monthly → Annual: prorate remaining monthly period as a credit,
 *     charge the full annual amount immediately. Stripe handles the
 *     proration natively via `proration_behavior: "always_invoice"`.
 *
 *   - Annual → Monthly: disallowed mid-cycle (per spec — prevents
 *     refund-complexity). Returns 400 with the renewal date so the UI
 *     can show "Switch to monthly on {date}".
 *
 * Cross-cadence + cross-tier upgrades (e.g., Pro monthly → Signature
 * annual) go through `/api/billing/crm/checkout` instead — the user
 * cancels their current sub at period-end, then starts a fresh
 * annual subscription. That flow is one PR forward (PR 5 UI work)
 * — this endpoint intentionally rejects it with a clear error.
 */
export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    if (!isBillingCadence(body.cadence)) {
      return NextResponse.json(
        { error: 'Invalid cadence. Expected "monthly" or "annual".' },
        { status: 400 }
      );
    }
    const newCadence = body.cadence;

    const current = await getActiveCrmSubscription(user.id);
    if (!current) {
      return NextResponse.json(
        { error: "No active subscription to switch. Start a subscription first." },
        { status: 400 }
      );
    }

    if (current.plan === "starter") {
      return NextResponse.json(
        { error: "Starter is the free tier — no cadence to switch." },
        { status: 400 }
      );
    }

    if (current.cadence === newCadence) {
      return NextResponse.json(
        { error: `You're already on ${newCadence} billing.` },
        { status: 400 }
      );
    }

    if (current.cadence === "annual" && newCadence === "monthly") {
      // Per spec: A→M is disallowed mid-cycle. Surface the renewal date
      // so the UI can offer "Switch on {date}". Implementing the actual
      // deferred switch is a separate concern (Stripe Subscription
      // Schedules); for now we reject and document the next step.
      const { data: row } = await supabaseAdmin
        .from("subscriptions")
        .select("current_period_end")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const renewsAt =
        (row as { current_period_end?: string | null } | null)?.current_period_end ?? null;

      return NextResponse.json(
        {
          error:
            "Annual → monthly switches are only allowed at your next renewal. Cancel auto-renewal in account → Billing to drop to monthly after your annual period ends.",
          code: "ANNUAL_TO_MONTHLY_DEFERRED",
          renewsAt,
        },
        { status: 400 }
      );
    }

    // Monthly → Annual upgrade path. Look up the user's Stripe subscription,
    // swap the item price to the annual SKU for the same tier, and let
    // Stripe prorate the difference + bill immediately.
    const { data: subRow, error: subErr } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subErr) throw subErr;

    const stripeSubscriptionId =
      (subRow as { stripe_subscription_id?: string | null } | null)?.stripe_subscription_id ?? null;
    if (!stripeSubscriptionId) {
      return NextResponse.json(
        { error: "No linked Stripe subscription. Contact support." },
        { status: 400 }
      );
    }

    let annualPriceId: string;
    try {
      annualPriceId = getCrmStripePriceId(current.plan, "annual");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Annual price lookup failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const firstItem = subscription.items.data[0];
    if (!firstItem) {
      return NextResponse.json(
        { error: "Stripe subscription has no items. Contact support." },
        { status: 500 }
      );
    }

    const updated = await stripe.subscriptions.update(stripeSubscriptionId, {
      items: [{ id: firstItem.id, price: annualPriceId }],
      proration_behavior: "always_invoice",
      metadata: {
        ...(subscription.metadata ?? {}),
        billing_cadence: "annual",
      },
      // Surface the new annual cadence on Stripe so the next webhook
      // event resolves correctly via metadata.
    });

    return NextResponse.json({
      ok: true,
      cadence: "annual",
      subscriptionId: updated.id,
      message: "Switched to annual billing. Stripe issued a prorated invoice for the difference.",
    });
  } catch (e: unknown) {
    console.error("crm change-cadence error", e);
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
