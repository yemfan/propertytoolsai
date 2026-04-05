import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { PLANS } from "@/lib/billing/plans";
import {
  billingPageAbsoluteUrl,
  getCrmSubscriptionSnapshot,
} from "@/lib/billing/subscriptionAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Current user's active CRM subscription + feature list + billing details (invoices, payment method).
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUserWithRole(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const subscription = await getCrmSubscriptionSnapshot(user.id);

    // Fetch extra billing fields stored on leadsmart_users
    const { data: lu } = await supabaseAdmin
      .from("leadsmart_users")
      .select(
        "stripe_customer_id,stripe_subscription_id,subscription_current_period_end,subscription_cancel_at_period_end"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    const stripeCustomerId =
      (lu as { stripe_customer_id?: string | null } | null)?.stripe_customer_id ?? null;

    const currentPeriodEnd =
      (lu as { subscription_current_period_end?: string | null } | null)
        ?.subscription_current_period_end ?? null;

    const cancelAtPeriodEnd =
      (lu as { subscription_cancel_at_period_end?: boolean | null } | null)
        ?.subscription_cancel_at_period_end ?? false;

    // Fetch recent invoices + default payment method from Stripe
    let invoices: {
      id: string;
      date: string;
      amount: number;
      currency: string;
      status: string;
      pdf: string | null;
    }[] = [];
    let paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number } | null =
      null;

    if (stripeCustomerId) {
      try {
        const [invoiceList, customer] = await Promise.all([
          stripe.invoices.list({ customer: stripeCustomerId, limit: 5 }),
          stripe.customers.retrieve(stripeCustomerId, {
            expand: ["invoice_settings.default_payment_method"],
          }),
        ]);

        invoices = invoiceList.data.map((inv) => ({
          id: inv.id,
          date: new Date((inv.created ?? 0) * 1000).toISOString(),
          amount: (inv.amount_paid ?? 0) / 100,
          currency: (inv.currency ?? "usd").toUpperCase(),
          status: inv.status ?? "unknown",
          pdf: inv.invoice_pdf ?? null,
        }));

        if (
          customer &&
          !("deleted" in customer) &&
          customer.invoice_settings?.default_payment_method &&
          typeof customer.invoice_settings.default_payment_method !== "string"
        ) {
          const pm = customer.invoice_settings.default_payment_method;
          if (pm.type === "card" && pm.card) {
            paymentMethod = {
              brand: pm.card.brand ?? "card",
              last4: pm.card.last4 ?? "****",
              expMonth: pm.card.exp_month ?? 0,
              expYear: pm.card.exp_year ?? 0,
            };
          }
        }
      } catch {
        // Non-fatal — billing details just won't show
      }
    }

    return NextResponse.json({
      ok: true,
      subscription,
      catalog: PLANS,
      billingPageUrl: billingPageAbsoluteUrl(),
      currentPeriodEnd,
      cancelAtPeriodEnd,
      invoices,
      paymentMethod,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("GET /api/billing/subscription", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
