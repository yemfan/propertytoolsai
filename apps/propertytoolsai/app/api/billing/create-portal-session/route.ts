import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { getStripeCustomerIdForUser } from "@/lib/stripeCustomerForUser";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabase = supabaseServerClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    const user = userData.user;
    if (!user?.id) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const customer = await getStripeCustomerIdForUser(user.id);
    if (!customer) {
      return NextResponse.json(
        { success: false, error: "No Stripe customer found. Subscribe to a plan first." },
        { status: 400 }
      );
    }

    const origin = new URL(req.url).origin;
    const portal = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${origin}/account/billing`,
    });

    if (!portal.url) {
      return NextResponse.json(
        { success: false, error: "Stripe did not return a portal URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, url: portal.url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[create-portal-session]", e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
