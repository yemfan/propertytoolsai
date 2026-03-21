import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseServerClient } from "@/lib/supabaseServerClient";

export async function POST(req: Request) {
  try {
    const supabase = supabaseServerClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    const user = userData.user;
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: agent, error } = await supabase
      .from("agents")
      .select("stripe_customer_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (error && (error as any).code !== "PGRST116") throw error;
    const customer = (agent as any)?.stripe_customer_id as string | undefined;
    if (!customer) {
      return NextResponse.json(
        { error: "No Stripe customer found" },
        { status: 400 }
      );
    }

    const origin = new URL(req.url).origin;
    const portal = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${origin}/dashboard`,
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

