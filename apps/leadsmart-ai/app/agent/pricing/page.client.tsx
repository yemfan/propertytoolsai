"use client";

import { useEffect, useState } from "react";

type AgentPlan = "starter" | "growth" | "elite";

type AccessResponse = {
  success?: boolean;
  ok?: boolean;
  hasAccess: boolean;
  entitlement: {
    plan: AgentPlan;
    is_active: boolean;
  } | null;
};

const PLANS: Array<{
  key: AgentPlan;
  name: string;
  price: string;
  /** Maps to `POST /api/create-checkout-session` body `{ plan }` */
  checkoutPlan?: "pro" | "premium";
  description: string;
  features: string[];
  cta: string;
  featured?: boolean;
}> = [
  {
    key: "starter",
    name: "Starter",
    price: "Free",
    description: "For new agents testing the platform.",
    features: [
      "2 CMA reports / day",
      "Up to 5 leads",
      "Basic alerts",
      "Up to 50 contacts",
      "Limited report downloads",
      "No team access",
    ],
    cta: "Start Free",
  },
  {
    key: "growth",
    name: "Growth",
    price: "$49/mo",
    checkoutPlan: "pro",
    description: "For active agents closing deals consistently.",
    features: [
      "5 CMA reports / day",
      "Up to 500 leads",
      "Full alerts + engagement tracking",
      "Up to 500 contacts",
      "Full report downloads",
      "No team access",
    ],
    cta: "Upgrade to Growth",
    featured: true,
  },
  {
    key: "elite",
    name: "Elite",
    price: "$99/mo",
    checkoutPlan: "premium",
    description: "For top producers and growing teams.",
    features: [
      "10 CMA reports / day (expandable)",
      "Unlimited leads",
      "Advanced alerts + automation",
      "Unlimited contacts",
      "Unlimited downloads",
      "Team access included",
    ],
    cta: "Go Elite",
  },
];

export default function AgentPricingClientPage() {
  const [loadingPlan, setLoadingPlan] = useState<string>("");
  const [currentPlan, setCurrentPlan] = useState<AgentPlan | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [error, setError] = useState("");

  async function loadAccess() {
    try {
      const res = await fetch("/api/agent/access-check", {
        cache: "no-store",
        credentials: "include",
      });

      if (!res.ok) return;

      const json = (await res.json()) as AccessResponse;

      if (json?.success === true || json?.ok === true) {
        setHasAccess(json.hasAccess);
        setCurrentPlan(json.entitlement?.plan ?? null);
      }
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    void loadAccess();
  }, []);

  async function handleStarter() {
    try {
      setLoadingPlan("starter");
      setError("");

      const res = await fetch("/api/agent/start-free", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "starter" }),
      });

      const json = (await res.json()) as { success?: boolean; ok?: boolean; error?: string; redirectTo?: string };

      if (!res.ok || json?.success === false || json?.ok === false) {
        throw new Error(json?.error || "Failed to activate Starter");
      }

      window.location.href = json.redirectTo || "/agent/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate Starter");
    } finally {
      setLoadingPlan("");
    }
  }

  async function handlePaidPlan(plan: "pro" | "premium") {
    try {
      setLoadingPlan(plan);
      setError("");

      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const json = (await res.json()) as { success?: boolean; error?: string; url?: string };

      if (!res.ok) {
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
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">
            LeadSmart AI for Agents
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-600 md:text-lg">
            Start free, then upgrade as your pipeline grows. Unlock more CMA reports,
            higher lead capacity, stronger CRM tools, and advanced automation.
          </p>
          {hasAccess && currentPlan && (
            <div className="mt-4 inline-flex rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white">
              Current plan: {currentPlan}
            </div>
          )}
        </div>

        {error && (
          <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.key;

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
                  {plan.key === "starter" ? (
                    <button
                      type="button"
                      disabled={isCurrent || loadingPlan === "starter"}
                      onClick={() => void handleStarter()}
                      className="w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      {isCurrent
                        ? "Current Plan"
                        : loadingPlan === "starter"
                          ? "Activating..."
                          : plan.cta}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isCurrent || !plan.checkoutPlan || loadingPlan === plan.checkoutPlan}
                      onClick={() => plan.checkoutPlan && void handlePaidPlan(plan.checkoutPlan)}
                      className="w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      {isCurrent
                        ? "Current Plan"
                        : loadingPlan === plan.checkoutPlan
                          ? "Redirecting..."
                          : plan.cta}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-gray-900">
            Which plan is right for you?
          </h3>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-gray-50 p-5">
              <div className="text-sm font-semibold text-gray-900">Starter</div>
              <p className="mt-2 text-sm text-gray-600">
                Best for testing the workspace and getting your first leads organized.
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-5">
              <div className="text-sm font-semibold text-gray-900">Growth</div>
              <p className="mt-2 text-sm text-gray-600">
                Best for solo agents actively converting leads and managing a serious pipeline.
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-5">
              <div className="text-sm font-semibold text-gray-900">Elite</div>
              <p className="mt-2 text-sm text-gray-600">
                Best for top producers and teams needing scale, automation, and collaboration.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
