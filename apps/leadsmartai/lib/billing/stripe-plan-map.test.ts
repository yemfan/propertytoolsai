import { describe, expect, it } from "vitest";
import { mapStripePriceToPlan, resolveInternalPlanFromStripeSubscription } from "./stripe-plan-map";

describe("resolveInternalPlanFromStripeSubscription", () => {
  it("uses price map when metadata has no internal_plan", () => {
    expect(resolveInternalPlanFromStripeSubscription("price_agent_pro", {})).toBe("agent_pro");
    expect(mapStripePriceToPlan("price_unknown")).toBe("consumer_free");
    expect(resolveInternalPlanFromStripeSubscription("price_unknown", {})).toBe("consumer_free");
  });

  it("prefers subscription metadata internal_plan when price id is unknown", () => {
    expect(
      resolveInternalPlanFromStripeSubscription("price_from_dashboard_stripe_only", {
        internal_plan: "agent_starter",
      })
    ).toBe("agent_starter");
  });

  it("supports CRM plan metadata", () => {
    expect(
      resolveInternalPlanFromStripeSubscription("price_unknown", {
        internal_plan: "crm_pro",
      })
    ).toBe("crm_pro");
  });
});
