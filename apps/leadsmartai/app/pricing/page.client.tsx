"use client";

import { useEffect, useState } from "react";
import type { InternalPlan as BillingPlan } from "@/lib/billing/stripe-plan-map";

type ConsumerPlan = "free" | "premium";

type BillingResponse = {
  success: true;
  billing: {
    plan: BillingPlan;
    status: string;
  } | null;
};

const PLANS: Array<{
  key: ConsumerPlan;
  billingPlan: BillingPlan;
  name: string;
  price: string;
  priceId?: string;
  description: string;
  features: string[];
  cta: string;
  featured?: boolean;
}> = [
  {
    key: "free",
    billingPlan: "consumer_free",
    name: "Free",
    price: "$0",
    description: "For casual users exploring property tools and estimates.",
    features: [
      "Access to core calculators",
      "Basic property insights",
      "Limited saved results",
      "Standard tool access",
      "No premium AI features",
    ],
    cta: "Current Free Plan",
  },
  {
    key: "premium",
    billingPlan: "consumer_premium",
    name: "Premium",
    price: "$19/mo",
    priceId: "price_consumer_premium",
    description: "For serious buyers, sellers, and investors who want deeper insights.",
    features: [
      "Premium AI property tools",
      "Advanced comparisons",
      "Expanded saved history",
      "Priority insights",
      "More powerful decision support",
    ],
    cta: "Upgrade to Premium",
    featured: true,
  },
];

export default function ConsumerPricingClientPage() {
  const [currentPlan, setCurrentPlan] = useState<BillingPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState("");
  const [error, setError] = useState("");

  async function loadBilling() {
    try {
      const res = await fetch("/api/account/billing", {
        cache: "no-store",
        credentials: "include",
      });

      if (!res.ok) {
        setCurrentPlan("consumer_free");
        return;
      }

      const json = (await res.json()) as BillingResponse | { success?: boolean };

      if (json && "success" in json && json.success === true && "billing" in json) {
        setCurrentPlan(json.billing?.plan ?? "consumer_free");
      } else {
        setCurrentPlan("consumer_free");
      }
    } catch {
      setCurrentPlan("consumer_free");
    }
  }

  useEffect(() => {
    void loadBilling();
  }, []);

  async function handlePaidPlan(priceId: string) {
    try {
      setLoadingPlan(priceId);
      setError("");

      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });

      const json = (await res.json()) as { success?: boolean; ok?: boolean; error?: string; url?: string };

      if (!res.ok || json?.success === false || json?.ok === false) {
        throw new Error(json?.error || "Failed to create checkout session");
      }

      if (!json.url) {
        throw new Error("Missing checkout URL");
      }

      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setLoadingPlan("");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 md:px-6">
      <div className="mx-auto max-w-5xl space-y-10">
        <div className="text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">
            LeadSmart AI — Consumer plans
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-600 md:text-lg">
            Free and Premium access to PropertyTools AI calculators and insights. Agents: see{" "}
            <a href="/agent/pricing" className="font-semibold text-[#0072ce] underline underline-offset-2 hover:text-[#005fa3]">
              LeadSmart AI pricing for agents
            </a>
            .
          </p>
          {currentPlan && (
            <div className="mt-4 inline-flex rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white">
              Current plan: {currentPlan.replace(/_/g, " ")}
            </div>
          )}
        </div>

        {error && (
          <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.billingPlan;

            return (
              <div
                key={plan.key}
                className={[
                  "rounded-3xl border bg-white p-6 shadow-sm",
                  plan.featured ? "border-gray-900 ring-1 ring-gray-900" : "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">{plan.name}</h2>
                    <div className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
                      {plan.price}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-gray-600">
                      {plan.description}
                    </p>
                  </div>

                  {plan.featured && (
                    <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white">
                      Popular
                    </span>
                  )}
                </div>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700"
                    >
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {plan.key === "free" ? (
                    <button
                      type="button"
                      disabled
                      className="w-full rounded-2xl bg-gray-200 px-4 py-3 text-sm font-medium text-gray-600"
                    >
                      {isCurrent ? "Current Plan" : plan.cta}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isCurrent || !plan.priceId || loadingPlan === plan.priceId}
                      onClick={() => plan.priceId && void handlePaidPlan(plan.priceId)}
                      className="w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      {isCurrent
                        ? "Current Plan"
                        : loadingPlan === plan.priceId
                          ? "Redirecting..."
                          : plan.cta}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
