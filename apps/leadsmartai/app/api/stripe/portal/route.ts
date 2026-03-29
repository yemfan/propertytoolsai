import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { getStripeCustomerIdForUser } from "@/lib/stripeCustomerForUser";

export async function POST(req: Request) {
  try {
    const supabase = supabaseServerClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    const user = userData.user;
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const customer = await getStripeCustomerIdForUser(user.id);
    if (!customer) {
      return NextResponse.json(
        { error: "No Stripe customer found" },
        { status: 400 }
      );
    }

    const origin = new URL(req.url).origin;
    const portal = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${origin}/dashboard/billing`,
    });

    // If called from a form POST, redirect; otherwise JSON.
    const accept = req.headers.get("accept") || "";
    if (accept.includes("text/html")) {
      return NextResponse.redirect(portal.url, { status: 303 });
    }
    return NextResponse.json({ url: portal.url });
  } catch (e: any) {
    console.error("stripe portal error", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

