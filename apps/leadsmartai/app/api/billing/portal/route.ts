import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { stripe } from "@/lib/stripe/server";
import { getStripeCustomerIdForUser } from "@/lib/stripeCustomerForUser";

export const runtime = "nodejs";

function siteOrigin(req: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  return new URL(req.url).origin;
}

/**
 * Stripe Customer Portal (manage card, cancel, invoices). Same behavior as `POST /api/stripe/portal`.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUserWithRole(req);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const customer = await getStripeCustomerIdForUser(user.id);
    if (!customer) {
      return NextResponse.json(
        { error: "No Stripe customer on file. Complete a subscription checkout first." },
        { status: 400 }
      );
    }

    const origin = siteOrigin(req);
    const portal = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${origin}/dashboard/billing`,
    });

    const accept = req.headers.get("accept") || "";
    if (accept.includes("text/html")) {
      return NextResponse.redirect(portal.url, { status: 303 });
    }
    return NextResponse.json({ ok: true, url: portal.url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/billing/portal", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
