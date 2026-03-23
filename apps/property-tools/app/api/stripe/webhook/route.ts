import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { persistAgentAndProfileFromSubscription } from "@/lib/stripeSubscriptionApply";
import { recordStripeInvoiceRevenue } from "@/lib/revenueKpi/stripeSync";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : String(err);
    console.error("Webhook signature verification failed", m);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = (session.metadata?.user_id as string | undefined) ?? null;
      const customerId = (session.customer as string | null) ?? null;
      const subscriptionId = (session.subscription as string | null) ?? null;

      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await persistAgentAndProfileFromSubscription({
          userId: userId ?? (sub.metadata?.user_id as string | undefined) ?? null,
          customerId,
          subscriptionId,
          subscription: sub,
          checkoutPlanMeta: session.metadata?.plan ?? session.metadata?.billing_plan ?? null,
        });
      }
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = ((invoice as { subscription?: string | null }).subscription as string | null) ?? null;
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await persistAgentAndProfileFromSubscription({
          userId: (sub.metadata?.user_id as string | undefined) ?? null,
          customerId: (sub.customer as string | null) ?? null,
          subscriptionId,
          subscription: sub,
          checkoutPlanMeta: null,
        });
      }

      try {
        await recordStripeInvoiceRevenue(invoice);
      } catch (e) {
        console.error("recordStripeInvoiceRevenue", e);
      }
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      await persistAgentAndProfileFromSubscription({
        userId: (sub.metadata?.user_id as string | undefined) ?? null,
        customerId: (sub.customer as string) ?? null,
        subscriptionId: sub.id,
        subscription: sub,
        checkoutPlanMeta: sub.metadata?.plan ?? sub.metadata?.billing_plan ?? null,
      });
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      await persistAgentAndProfileFromSubscription({
        userId: (sub.metadata?.user_id as string | undefined) ?? null,
        customerId: (sub.customer as string) ?? null,
        subscriptionId: sub.id,
        subscription: sub,
        checkoutPlanMeta: null,
      });
    }

    return NextResponse.json({ received: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("stripe webhook handler error", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
