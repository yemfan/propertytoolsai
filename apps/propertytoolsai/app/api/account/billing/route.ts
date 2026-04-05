import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rowToBillingRecord } from "@/lib/billingAccountRecord";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

type Invoice = {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  pdf: string | null;
};

type PaymentMethod = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

/**
 * Latest `billing_subscriptions` row for the signed-in user, plus Stripe invoice
 * and payment-method data when a Stripe customer ID is on record.
 */
export async function GET() {
  try {
    const user = await getCurrentUserWithRole();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // ── Subscription row ──────────────────────────────────────────────────────
    const { data, error } = await supabaseAdmin
      .from("billing_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const billing = data ? rowToBillingRecord(data as Record<string, unknown>) : null;

    // ── Stripe customer ID (agents → propertytools_users) ─────────────────────
    let stripeCustomerId: string | null = null;
    try {
      const [{ data: agentRow }, { data: ptRow }] = await Promise.all([
        supabaseAdmin
          .from("agents")
          .select("stripe_customer_id")
          .eq("auth_user_id", user.id)
          .maybeSingle(),
        supabaseAdmin
          .from("propertytools_users")
          .select("stripe_customer_id")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      stripeCustomerId =
        (agentRow as { stripe_customer_id?: string } | null)?.stripe_customer_id ||
        (ptRow as { stripe_customer_id?: string } | null)?.stripe_customer_id ||
        null;
    } catch {
      // Non-fatal
    }

    // ── Stripe invoices + payment method ──────────────────────────────────────
    let invoices: Invoice[] = [];
    let paymentMethod: PaymentMethod | null = null;

    if (stripeCustomerId) {
      try {
        const [invoiceList, customer] = await Promise.all([
          stripe.invoices.list({ customer: stripeCustomerId, limit: 12 }),
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
      success: true,
      billing,
      invoices,
      paymentMethod,
    });
  } catch (error) {
    console.error("[account/billing]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load account billing" },
      { status: 500 }
    );
  }
}
