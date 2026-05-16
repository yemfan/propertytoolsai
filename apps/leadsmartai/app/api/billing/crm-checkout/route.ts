import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { recordUpgradeCheckoutStarted } from "@/lib/funnel/funnelAnalytics";
import { getCrmStripePriceId, internalPlanForCrmSlug } from "@/lib/billing/crmStripePrices";
import { PLANS, type BillingCadence, type PlanSlug } from "@/lib/billing/plans";
import { stripe } from "@/lib/stripe/server";

/**
 * v2.0 CRM checkout. Accepts a CRM tier slug (paid tiers only) and an
 * optional cadence + trial flag. `starter` is the free tier and has
 * no Stripe Price ID — the dashboard billing page renders it as
 * "Free — included by default" instead of going through this endpoint.
 *
 * Body is back-compat: legacy callers pass `{ plan }` and get monthly
 * cadence with no trial. v2.0 callers pass `{ plan, cadence, with_trial }`.
 */
const bodySchema = z.object({
  plan: z.enum(["pro", "premium", "signature", "team"]),
  cadence: z.enum(["monthly", "annual"]).optional().default("monthly"),
  with_trial: z.boolean().optional().default(false),
});

function siteOrigin(req: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  return new URL(req.url).origin;
}

export const runtime = "nodejs";

/**
 * Stripe Checkout for LeadSmart CRM tiers (monthly or annual). Mobile clients should open `url` in the system browser.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUserWithRole(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!user.email) {
      return NextResponse.json({ ok: false, error: "Account email required for checkout" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid plan", issues: parsed.error.flatten() }, { status: 400 });
    }

    const plan = parsed.data.plan as PlanSlug;
    const cadence: BillingCadence = parsed.data.cadence;
    const withTrial = parsed.data.with_trial;

    const def = PLANS[plan];
    if (cadence === "annual" && def.annualPrice == null) {
      return NextResponse.json(
        { ok: false, error: `Annual cadence not offered for ${plan}.` },
        { status: 400 }
      );
    }

    let priceId: string;
    try {
      priceId = getCrmStripePriceId(plan, cadence);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stripe price lookup failed";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
    const internalPlan = internalPlanForCrmSlug(plan);
    const origin = siteOrigin(req);

    try {
      const priceRow = await stripe.prices.retrieve(priceId);
      if (!priceRow.active) {
        return NextResponse.json({ ok: false, error: "This Stripe price is inactive." }, { status: 400 });
      }
      if (priceRow.type !== "recurring") {
        return NextResponse.json({ ok: false, error: "Checkout requires a recurring subscription price." }, { status: 400 });
      }
      const expectedInterval = cadence === "annual" ? "year" : "month";
      if (priceRow.recurring?.interval !== expectedInterval) {
        return NextResponse.json(
          {
            ok: false,
            error: `Stripe price interval (${priceRow.recurring?.interval}) does not match cadence (${cadence}). Check env var wiring.`,
          },
          { status: 400 }
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid Stripe price";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    // CA BPC §17602 / NY GBL §527-a — surface the cadence and the
    // first-charge amount on Stripe Checkout's summary. The checkout
    // page itself is the affirmative-consent surface.
    const renewMsg =
      cadence === "annual"
        ? `You'll be charged $${def.annualPrice} today and your subscription will auto-renew annually until canceled. Cancel anytime from your account → Billing.`
        : `You'll be charged $${def.price} today and your subscription will auto-renew monthly until canceled. Cancel anytime from your account → Billing.`;

    const trialDays = Number(
      process.env.STRIPE_AGENT_TRIAL_DAYS ?? process.env.STRIPE_TRIAL_DAYS ?? 14
    );
    const applyTrial = withTrial && Number.isFinite(trialDays) && trialDays > 0;

    const session = await stripe.checkout.sessions.create({
      ui_mode: "hosted",
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: user.email,
      client_reference_id: user.id.slice(0, 200),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/checkout-success?session_id={CHECKOUT_SESSION_ID}&product=crm`,
      cancel_url: `${origin}/dashboard/billing?canceled=1`,
      allow_promotion_codes: true,
      custom_text: { submit: { message: renewMsg } },
      metadata: {
        user_id: user.id,
        email: user.email,
        internal_plan: internalPlan,
        crm_plan: plan,
        billing_cadence: cadence,
        product: "leadsmart_crm",
        ...(applyTrial ? { trial_checkout: "1" } : {}),
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          internal_plan: internalPlan,
          crm_plan: plan,
          billing_cadence: cadence,
          product: "leadsmart_crm",
        },
        ...(applyTrial ? { trial_period_days: trialDays } : {}),
      },
    });

    void recordUpgradeCheckoutStarted(user.id, plan);

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/billing/crm-checkout", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
