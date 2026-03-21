import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseServerClient } from "@/lib/supabaseServerClient";

type Body = { plan: "pro" | "premium" };

function getPriceId(plan: Body["plan"]) {
  if (plan === "pro") return process.env.STRIPE_PRICE_ID_PRO!;
  return process.env.STRIPE_PRICE_ID_PREMIUM!;
}

export async function POST(req: Request) {
  try {
    const supabase = supabaseServerClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    const user = userData.user;
    if (!user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    if (body.plan !== "pro" && body.plan !== "premium") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const price = getPriceId(body.plan);
    const origin = new URL(req.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/dashboard?success=true`,
      cancel_url: `${origin}/pricing?canceled=true`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan: body.plan,
        },
      },
      metadata: {
        user_id: user.id,
        plan: body.plan,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error("create-checkout-session error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

