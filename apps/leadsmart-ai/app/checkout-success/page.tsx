import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import {
  checkoutSuccessShouldSyncSubscription,
  persistAgentAndProfileFromSubscription,
} from "@/lib/stripeSubscriptionApply";

/**
 * Stripe `success_url` lands here first. We sync subscription from Stripe immediately so
 * `/dashboard` gating (user_profiles.subscription_status) does not race the webhook.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ session_id?: string }>;
}) {
  const sp = searchParams != null ? await searchParams : {};
  const sessionId = String(sp.session_id ?? "").trim();
  if (!sessionId) {
    redirect("/pricing?checkout_error=missing_session");
  }

  const supabase = supabaseServerClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    redirect(
      `/login?redirect=${encodeURIComponent(`/checkout-success?session_id=${encodeURIComponent(sessionId)}`)}`
    );
  }
  const user = userData.user;

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    redirect("/pricing?checkout_error=invalid_session");
  }

  const rawSub = session.subscription;
  const subId =
    typeof rawSub === "string"
      ? rawSub
      : rawSub && typeof (rawSub as Stripe.Subscription).id === "string"
        ? (rawSub as Stripe.Subscription).id
        : null;

  if (!subId) {
    redirect("/pricing?checkout_error=no_subscription");
  }

  const subscription = await stripe.subscriptions.retrieve(subId);

  const metaUserId =
    (session.metadata?.user_id as string | undefined) ??
    (subscription.metadata?.user_id as string | undefined) ??
    null;

  if (!metaUserId) {
    redirect("/pricing?checkout_error=no_metadata");
  }
  if (metaUserId !== user.id) {
    redirect("/pricing?checkout_error=session_user_mismatch");
  }

  if (session.mode !== "subscription") {
    redirect("/dashboard");
  }

  if (
    !checkoutSuccessShouldSyncSubscription({
      paymentStatus: session.payment_status,
      subscriptionStatus: subscription.status,
    })
  ) {
    redirect("/pricing?checkout_error=unpaid");
  }

  try {
    await persistAgentAndProfileFromSubscription({
      userId: user.id,
      customerId: (session.customer as string | null) ?? null,
      subscriptionId: subscription.id,
      subscription,
      checkoutPlanMeta: session.metadata?.plan ?? null,
    });
  } catch (e) {
    console.error("checkout-success persist failed", e);
    redirect("/pricing?checkout_error=sync_failed");
  }

  redirect("/dashboard?checkout=success");
}
