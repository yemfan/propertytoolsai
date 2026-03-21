import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabaseServer";
import { setUserPlanFromStripe } from "@/lib/subscriptionSync";

function planFromPriceId(
  priceId: string | null | undefined
): "pro" | "premium" | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ID_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_ID_PREMIUM) return "premium";
  return null;
}

async function upsertAgentStripe(params: {
  userId?: string | null;
  email?: string | null;
  planType: "free" | "pro" | "premium";
  customerId?: string | null;
  subscriptionId?: string | null;
  status?: string | null;
}) {
  // Prefer mapping by auth_user_id (Supabase Auth UUID in metadata), else fallback to Stripe customer id.
  if (params.userId) {
    const { error } = await supabaseServer
      .from("agents")
      .update({
        plan_type: params.planType,
        stripe_customer_id: params.customerId ?? null,
        stripe_subscription_id: params.subscriptionId ?? null,
      })
      .eq("auth_user_id", params.userId);
    if (error) throw error;

    // Keep user_profiles plan in sync with subscription.
    await setUserPlanFromStripe({
      userId: params.userId,
      plan: params.planType === "free" ? "free" : (params.planType as any),
      subscriptionStatus: params.status ?? (params.planType === "free" ? "canceled" : "active"),
      stripeCustomerId: params.customerId ?? null,
      stripeSubscriptionId: params.subscriptionId ?? null,
      resetTokens: params.planType === "free",
    });
    return;
  }

  if (params.customerId) {
    const { error } = await supabaseServer
      .from("agents")
      .update({
        plan_type: params.planType,
        stripe_customer_id: params.customerId ?? null,
        stripe_subscription_id: params.subscriptionId ?? null,
      })
      .eq("stripe_customer_id", params.customerId);
    if (error) throw error;
    return;
  }
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed", err?.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = (session.metadata?.user_id as string | undefined) ?? null;
      const customerId = (session.customer as string | null) ?? null;
      const subscriptionId = (session.subscription as string | null) ?? null;

      // Retrieve subscription to map price -> plan
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = sub.items.data[0]?.price?.id;
        const plan = planFromPriceId(priceId);
        const planType = plan ?? "free";

        await upsertAgentStripe({
          userId: userId ?? (sub.metadata?.user_id as string | undefined) ?? null,
          email: null,
          planType,
          customerId,
          subscriptionId,
          status: sub.status,
        });
      }
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        ((invoice as any).subscription as string | null) ?? null;
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = sub.items.data[0]?.price?.id;
        const plan = planFromPriceId(priceId);
        const planType =
          sub.status === "active" || sub.status === "trialing"
            ? plan ?? "free"
            : "free";
        await upsertAgentStripe({
          userId: (sub.metadata?.user_id as string | undefined) ?? null,
          email: null,
          planType,
          customerId: (sub.customer as string | null) ?? null,
          subscriptionId,
          status: sub.status,
        });
      }
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = (sub.customer as string) ?? null;
      const subscriptionId = sub.id;
      const priceId = sub.items.data[0]?.price?.id;
      const plan = planFromPriceId(priceId);

      const planType =
        sub.status === "active" || sub.status === "trialing"
          ? plan ?? "free"
          : "free";

      const userId = (sub.metadata?.user_id as string | undefined) ?? null;

      await upsertAgentStripe({
        userId,
        email: null,
        planType,
        customerId,
        subscriptionId,
        status: sub.status,
      });
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = (sub.customer as string) ?? null;
      const subscriptionId = sub.id;
      const userId = (sub.metadata?.user_id as string | undefined) ?? null;

      await upsertAgentStripe({
        userId,
        email: null,
        planType: "free",
        customerId,
        subscriptionId,
        status: "canceled",
      });
    }

    return NextResponse.json({ received: true });
  } catch (e: any) {
    console.error("stripe webhook handler error", e);
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

