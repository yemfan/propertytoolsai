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
  opts?: { priceId?: string; planMeta?: string; internalPlan?: string }
): Stripe.Subscription {
  const metadata: Record<string, string> = {};
  if (opts?.planMeta) metadata.plan = opts.planMeta;
  if (opts?.internalPlan) metadata.internal_plan = opts.internalPlan;
  return {
    status,
    items: { data: [{ price: { id: opts?.priceId ?? undefined } }] },
    metadata,
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
  it("active + team stays team", () => {
    expect(
      computeAgentPlanFromSubscriptionSync({
        subscriptionStatus: "active",
        resolvedPaidPlan: "team",
      })
    ).toBe("team");
  });
  it("trialing + team stays team", () => {
    expect(
      computeAgentPlanFromSubscriptionSync({
        subscriptionStatus: "trialing",
        resolvedPaidPlan: "team",
      })
    ).toBe("team");
  });
  it("downgrades team to free when subscription is canceled", () => {
    expect(
      computeAgentPlanFromSubscriptionSync({
        subscriptionStatus: "canceled",
        resolvedPaidPlan: "team",
      })
    ).toBe("free");
  });
});

describe("resolvePaidPlanFromStripe", () => {
  let prevPro: string | undefined;
  let prevConsumerPremium: string | undefined;
  let prevAgentTeam: string | undefined;

  beforeEach(() => {
    prevPro = process.env.STRIPE_PRICE_ID_PRO;
    prevConsumerPremium = process.env.STRIPE_PRICE_ID_CONSUMER_PREMIUM;
    prevAgentTeam = process.env.STRIPE_PRICE_ID_AGENT_TEAM;
    process.env.STRIPE_PRICE_ID_PRO = "price_pro_test";
    process.env.STRIPE_PRICE_ID_CONSUMER_PREMIUM = "price_premium_test";
    process.env.STRIPE_PRICE_ID_AGENT_TEAM = "price_team_test";
  });

  afterEach(() => {
    if (prevPro === undefined) delete process.env.STRIPE_PRICE_ID_PRO;
    else process.env.STRIPE_PRICE_ID_PRO = prevPro;
    if (prevConsumerPremium === undefined) delete process.env.STRIPE_PRICE_ID_CONSUMER_PREMIUM;
    else process.env.STRIPE_PRICE_ID_CONSUMER_PREMIUM = prevConsumerPremium;
    if (prevAgentTeam === undefined) delete process.env.STRIPE_PRICE_ID_AGENT_TEAM;
    else process.env.STRIPE_PRICE_ID_AGENT_TEAM = prevAgentTeam;
  });

  it("uses env price id for pro", () => {
    expect(resolvePaidPlanFromStripe(mockSubscription("active", { priceId: "price_pro_test" }))).toBe("pro");
  });
  it("uses env price id for premium (STRIPE_PRICE_ID_CONSUMER_PREMIUM)", () => {
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

  it("agent_team internal_plan resolves to team (highest precedence)", () => {
    // Even with a mismatched price, internal_plan="agent_team" wins.
    expect(
      resolvePaidPlanFromStripe(
        mockSubscription("active", { internalPlan: "agent_team", priceId: "price_pro_test" }),
      ),
    ).toBe("team");
  });
  it("uses STRIPE_PRICE_ID_AGENT_TEAM env price for team", () => {
    expect(
      resolvePaidPlanFromStripe(mockSubscription("active", { priceId: "price_team_test" })),
    ).toBe("team");
  });
  it("falls back to subscription metadata plan=team", () => {
    expect(
      resolvePaidPlanFromStripe(mockSubscription("active", { planMeta: "team" })),
    ).toBe("team");
  });
  it("checkout metadata 'team' wins over unknown price", () => {
    expect(
      resolvePaidPlanFromStripe(
        mockSubscription("active", { priceId: "price_unknown" }),
        "team",
      ),
    ).toBe("team");
  });
  it("crm_team internal_plan stays as premium (not team) — CRM bundle preserved", () => {
    expect(
      resolvePaidPlanFromStripe(mockSubscription("active", { internalPlan: "crm_team" })),
    ).toBe("premium");
  });
});
