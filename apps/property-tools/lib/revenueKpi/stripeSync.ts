import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabaseServer";
import { insertRevenueTransaction } from "./db";

/**
 * Maps Stripe invoice.paid → revenue_transactions (idempotent via external_ref).
 */
export async function recordStripeInvoiceRevenue(invoice: Stripe.Invoice): Promise<void> {
  const amount = invoice.amount_paid ?? 0;
  if (amount <= 0) return;

  const inv = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };
  const subscriptionId =
    typeof inv.subscription === "string"
      ? inv.subscription
      : (inv.subscription as Stripe.Subscription | null)?.id ?? null;

  let userId: string | null =
    (invoice.metadata?.user_id as string | undefined) ?? null;

  if (subscriptionId && !userId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      userId = (sub.metadata?.user_id as string | undefined) ?? null;
    } catch {
      return;
    }
  }

  if (!userId) return;

  const { data: agent, error } = await supabaseServer
    .from("agents")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (error || !agent) return;

  const agentId = String((agent as { id: string }).id);
  const externalRef = `stripe_invoice_${invoice.id}`;

  await insertRevenueTransaction({
    agentId,
    amountCents: amount,
    currency: (invoice.currency ?? "usd").toLowerCase(),
    category: "subscription",
    source: "stripe",
    externalRef,
    metadata: {
      invoice_id: invoice.id,
      subscription_id: subscriptionId,
    },
    occurredAt: (() => {
      const paidAt = (invoice as { status_transitions?: { paid_at?: number } }).status_transitions
        ?.paid_at;
      return paidAt ? new Date(paidAt * 1000).toISOString() : undefined;
    })(),
  });
}
