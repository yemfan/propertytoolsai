import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import {
  getStripePriceIdForBillingCheckoutKey,
  getBillingPlanFromCheckoutKey,
  type BillingCheckoutPriceKey,
} from "@/lib/billingAccountPriceKeys";
import { assertCheckoutAllowedForBillingKey } from "@/lib/billingCheckoutEligibility";

export const dynamic = "force-dynamic";

type Body = { priceId?: string };

export async function POST(req: Request) {
  try {
    const supabase = supabaseServerClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    const user = userData.user;
    if (!user?.email) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const priceKey = String(body.priceId ?? "").trim();
    if (!priceKey) {
      return NextResponse.json({ success: false, error: "Missing priceId" }, { status: 400 });
    }

    const gate = await assertCheckoutAllowedForBillingKey(user.id, priceKey);
    if (gate.ok === false) {
      return NextResponse.json({ success: false, error: gate.error }, { status: 403 });
    }

    const stripePrice = getStripePriceIdForBillingCheckoutKey(priceKey);
    const billingPlan = getBillingPlanFromCheckoutKey(priceKey as BillingCheckoutPriceKey);
    const origin = new URL(req.url).origin;

    try {
      const priceRow = await stripe.prices.retrieve(stripePrice);
      if (!priceRow.active) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This Stripe price is inactive. In Stripe Dashboard → Products, activate the price, or set STRIPE_PRICE_ID_CONSUMER_PREMIUM in your deployment env to an active price ID.",
          },
          { status: 400 }
        );
      }
      if (priceRow.type !== "recurring") {
        return NextResponse.json(
          {
            success: false,
            error: "Checkout requires a recurring subscription price.",
          },
          { status: 400 }
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid Stripe price";
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      line_items: [{ price: stripePrice, quantity: 1 }],
      success_url: `${origin}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/account/billing?canceled=1`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          user_id: user.id,
          billing_plan: billingPlan,
        },
      },
      metadata: {
        user_id: user.id,
        billing_plan: billingPlan,
        price_key: priceKey,
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { success: false, error: "Stripe did not return a checkout URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, url: session.url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[create-checkout-session]", e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
