import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  checkoutPaymentIndicatesSuccess,
  checkoutSuccessShouldSyncSubscription,
  computeAgentPlanFromSubscriptionSync,
  resolvePaidPlanFromStripe,
  subscriptionStatusIndicatesPaidAccess,
} from "./stripeSubscriptionApply";

function mockSubscription(
  status: Stripe.Subscription["status"],
  opts?: { priceId?: string; planMeta?: string }
): Stripe.Subscription {
  return {
    status,
    items: { data: [{ price: { id: opts?.priceId ?? undefined } }] },
    metadata: opts?.planMeta ? { plan: opts.planMeta } : {},
  } as unknown as Stripe.Subscription;
}

describe("checkoutPaymentIndicatesSuccess", () => {
  it("accepts paid", () => {
    expect(checkoutPaymentIndicatesSuccess("paid")).toBe(true);
  });
  it("accepts no_payment_required", () => {
    expect(checkoutPaymentIndicatesSuccess("no_payment_required")).toBe(true);
  });
  it("rejects unpaid", () => {
    expect(checkoutPaymentIndicatesSuccess("unpaid")).toBe(false);
  });
  it("rejects undefined", () => {
    expect(checkoutPaymentIndicatesSuccess(undefined)).toBe(false);
  });
});

describe("subscriptionStatusIndicatesPaidAccess", () => {
  it("active and trialing are paid-capable", () => {
    expect(subscriptionStatusIndicatesPaidAccess("active")).toBe(true);
    expect(subscriptionStatusIndicatesPaidAccess("trialing")).toBe(true);
  });
  it("other statuses are not", () => {
    expect(subscriptionStatusIndicatesPaidAccess("past_due")).toBe(false);
    expect(subscriptionStatusIndicatesPaidAccess("canceled")).toBe(false);
    expect(subscriptionStatusIndicatesPaidAccess("unpaid")).toBe(false);
    expect(subscriptionStatusIndicatesPaidAccess("incomplete")).toBe(false);
    expect(subscriptionStatusIndicatesPaidAccess("incomplete_expired")).toBe(false);
  });
});

describe("checkoutSuccessShouldSyncSubscription (paid vs unpaid gate)", () => {
  it("allows standard paid checkout", () => {
    expect(
      checkoutSuccessShouldSyncSubscription({
        paymentStatus: "paid",
        subscriptionStatus: "active",
      })
    ).toBe(true);
  });
  it("allows no_payment_required with active sub", () => {
    expect(
      checkoutSuccessShouldSyncSubscription({
        paymentStatus: "no_payment_required",
        subscriptionStatus: "active",
      })
    ).toBe(true);
  });
  it("allows trialing when session payment_status is unpaid (trial edge case)", () => {
    expect(
      checkoutSuccessShouldSyncSubscription({
        paymentStatus: "unpaid",
        subscriptionStatus: "trialing",
      })
    ).toBe(true);
  });
  it("blocks truly incomplete unpaid checkout", () => {
    expect(
      checkoutSuccessShouldSyncSubscription({
        paymentStatus: "unpaid",
        subscriptionStatus: "incomplete",
      })
    ).toBe(false);
  });
  it("blocks unpaid + past_due", () => {
    expect(
      checkoutSuccessShouldSyncSubscription({
        paymentStatus: "unpaid",
        subscriptionStatus: "past_due",
      })
    ).toBe(false);
  });
});

describe("computeAgentPlanFromSubscriptionSync", () => {
  it("downgrades to free when subscription is not active/trialing", () => {
    expect(
      computeAgentPlanFromSubscriptionSync({
        subscriptionStatus: "canceled",
        resolvedPaidPlan: "premium",
      })
    ).toBe("free");
    expect(
      computeAgentPlanFromSubscriptionSync({
        subscriptionStatus: "unpaid",
        resolvedPaidPlan: "premium",
      })
    ).toBe("free");
  });
  it("maps active + resolved premium to premium", () => {
    expect(
      computeAgentPlanFromSubscriptionSync({
        subscriptionStatus: "active",
        resolvedPaidPlan: "premium",
      })
    ).toBe("premium");
  });
  it("defaults active + unknown SKU to pro", () => {
    expect(
      computeAgentPlanFromSubscriptionSync({
        subscriptionStatus: "active",
        resolvedPaidPlan: "free",
      })
    ).toBe("pro");
  });
  it("trialing + pro stays pro", () => {
    expect(
      computeAgentPlanFromSubscriptionSync({
        subscriptionStatus: "trialing",
        resolvedPaidPlan: "pro",
      })
    ).toBe("pro");
  });
});

describe("resolvePaidPlanFromStripe", () => {
  let prevPro: string | undefined;
  let prevPremium: string | undefined;

  beforeEach(() => {
    prevPro = process.env.STRIPE_PRICE_ID_PRO;
    prevPremium = process.env.STRIPE_PRICE_ID_PREMIUM;
    process.env.STRIPE_PRICE_ID_PRO = "price_pro_test";
    process.env.STRIPE_PRICE_ID_PREMIUM = "price_premium_test";
  });

  afterEach(() => {
    if (prevPro === undefined) delete process.env.STRIPE_PRICE_ID_PRO;
    else process.env.STRIPE_PRICE_ID_PRO = prevPro;
    if (prevPremium === undefined) delete process.env.STRIPE_PRICE_ID_PREMIUM;
    else process.env.STRIPE_PRICE_ID_PREMIUM = prevPremium;
  });

  it("uses env price id for pro", () => {
    expect(resolvePaidPlanFromStripe(mockSubscription("active", { priceId: "price_pro_test" }))).toBe("pro");
  });
  it("uses env price id for premium", () => {
    expect(resolvePaidPlanFromStripe(mockSubscription("active", { priceId: "price_premium_test" }))).toBe(
      "premium"
    );
  });
  it("uses subscription metadata when price id unknown", () => {
    expect(resolvePaidPlanFromStripe(mockSubscription("active", { planMeta: "premium" }))).toBe("premium");
  });
  it("prefers checkout metadata over subscription when price unknown", () => {
    expect(resolvePaidPlanFromStripe(mockSubscription("active", { planMeta: "ignored" }), "pro")).toBe("pro");
  });
  it("returns free when nothing matches", () => {
    expect(resolvePaidPlanFromStripe(mockSubscription("active", { priceId: "price_unknown" }))).toBe("free");
  });
});
