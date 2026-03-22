import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { getStripePriceIdForPlan } from "@/lib/stripePriceIds";

type Body = { plan: "pro" | "premium"; with_trial?: boolean };

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    if (body.plan !== "pro" && body.plan !== "premium") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const withTrial = Boolean(body.with_trial) && body.plan === "pro";
    const trialDays = Number(process.env.STRIPE_TRIAL_DAYS ?? 7);

    const price = getStripePriceIdForPlan(body.plan);
    const origin = new URL(req.url).origin;
    const cancelUrl = withTrial
      ? `${origin}/pricing?trial_checkout=1&canceled=1`
      : `${origin}/pricing?checkout_canceled=1`;

    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: {
        user_id: user.id,
        plan: body.plan,
      },
    };
    if (withTrial && Number.isFinite(trialDays) && trialDays > 0) {
      subscriptionData.trial_period_days = trialDays;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/dashboard?success=true`,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      subscription_data: subscriptionData,
      metadata: {
        user_id: user.id,
        plan: body.plan,
        ...(withTrial ? { trial_checkout: "1" } : {}),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error("create-checkout-session error", e);
    const msg = String(e?.message ?? "Server error");
    const isConfig =
      msg.includes("STRIPE_PRICE_ID") ||
      msg.includes("Price ID") ||
      /No such price.*prod_/.test(msg);
    const friendly =
      /No such price.*prod_/.test(msg) || msg.includes("prod_")
        ? "Stripe is configured with a Product ID (prod_…) instead of a Price ID (price_…). Set STRIPE_PRICE_ID_PRO to the Price ID from Stripe → Products → Pricing."
        : msg;
    return NextResponse.json({ error: friendly }, { status: isConfig ? 400 : 500 });
  }
}

