import { getPaidSubscriptionEligibility } from "@/lib/paidSubscriptionEligibility";
import {
  getBillingPlanFromCheckoutKey,
  isBillingCheckoutPriceKey,
  type BillingCheckoutPriceKey,
} from "@/lib/billingAccountPriceKeys";

const PRO_ONLY_MSG =
  "Paid agent plans are for licensed agents, brokers, and teams. Create a professional account or contact support.";

export async function assertCheckoutAllowedForBillingKey(
  userId: string,
  priceKey: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isBillingCheckoutPriceKey(priceKey)) {
    return { ok: false, error: "Invalid plan selection." };
  }

  const plan = getBillingPlanFromCheckoutKey(priceKey as BillingCheckoutPriceKey);
  const elig = await getPaidSubscriptionEligibility(userId);

  if (!elig.allowed) {
    return { ok: false, error: "Unable to start checkout for this account." };
  }

  if (plan === "consumer_premium") {
    return { ok: true };
  }

  if (elig.reason === "consumer_permitted") {
    return { ok: false, error: PRO_ONLY_MSG };
  }

  if (plan === "loan_broker_pro") {
    // Optional stricter rule: only loan brokers — for now allow all non-consumer-paid users.
    return { ok: true };
  }

  return { ok: true };
}
