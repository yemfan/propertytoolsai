"use client";

import { useEffect, useState } from "react";
import { messageFromUnknownError } from "@/lib/supabaseThrow";

type AgentPlan = "starter" | "growth" | "elite" | "team";

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
  priceUnit?: string;
  /** Maps to `POST /api/create-checkout-session` body `{ plan, cancel_surface: "agent" }` */
  checkoutPlan?: "pro" | "premium";
  /** When set, the CTA links to a static URL instead of triggering checkout. */
  ctaHref?: string;
  description: string;
  features: string[];
  cta: string;
  featured?: boolean;
  /** Coaching badge displayed at the top of the card. */
  coachingBadge?: string;
}> = [
  {
    key: "starter",
    name: "Starter",
    price: "Free",
    description: "For new agents testing the platform.",
    features: [
      "Up to 5 leads · 50 contacts",
      "2 CMA reports / day",
      "AI SMS + email responder (basic)",
      "Click-to-call (Twilio bridge)",
      "Custom fields on contacts",
      "Reviews & testimonial capture",
      "Mobile app",
      "100 AI actions / month",
    ],
    cta: "Start Free",
  },
  {
    key: "growth",
    name: "Agent Pro",
    price: "$49/mo",
    checkoutPlan: "pro",
    description: "For active agents closing deals consistently.",
    coachingBadge: "Producer Track included",
    features: [
      "Everything in Starter, plus:",
      "Up to 500 leads · 500 contacts",
      "5 CMA reports / day",
      "Producer Track coaching (auto-enrolled)",
      "Email open / click tracking",
      "Video email (record & send)",
      "Newsletter / mass-email composer",
      "Listing presentation builder",
      "Vanity / call-tracking numbers",
      "Sphere prediction + equity signals",
      "Buyer Broker Agreement (BBA) workflow",
      "5,000 AI actions / month",
    ],
    cta: "Start 14-day trial",
    featured: true,
  },
  {
    key: "elite",
    name: "Agent Premium",
    price: "$99/mo",
    checkoutPlan: "premium",
    description: "For top producers running solo.",
    coachingBadge: "Top Producer Track included",
    features: [
      "Everything in Pro, plus:",
      "Unlimited leads & contacts",
      "Top Producer Track coaching",
      "ISA workflow + qualified handoff",
      "E-signature workflow (Dotloop / DocuSign)",
      "Advanced AI coaching + peer benchmarks",
      "Unlimited AI actions",
      "Priority support",
    ],
    cta: "Start 14-day trial",
  },
  {
    key: "team",
    name: "Team",
    price: "$199/mo",
    priceUnit: "per team",
    ctaHref: "/contact?topic=team",
    description: "For brokerages and small teams up to 5 seats.",
    coachingBadge: "Top Producer Track for whole team",
    features: [
      "Everything in Premium, plus:",
      "Up to 5 team seats (contact sales for more)",
      "Round-robin lead routing across the roster",
      "Per-member breakdown reporting",
      "Roster-wide dashboard rollups",
      "Top Producer Track for every member",
      "Team owner controls + seat invites",
    ],
    cta: "Contact sales",
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

      const json = (await res.json()) as { success?: boolean; ok?: boolean; error?: unknown; redirectTo?: string };

      if (!res.ok || json?.success === false || json?.ok === false) {
        throw new Error(messageFromUnknownError(json?.error, "Failed to activate Starter"));
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
        body: JSON.stringify({ plan, cancel_surface: "agent" }),
      });

      const json = (await res.json()) as { success?: boolean; error?: unknown; url?: string };

      if (!res.ok) {
        throw new Error(messageFromUnknownError(json?.error, "Failed to create checkout session"));
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
          {hasAccess && currentPlan ? (
            <>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-600 md:text-lg">
                You&apos;re on the <strong>{currentPlan}</strong> plan. Upgrade to unlock more CMA reports, higher lead
                capacity, stronger CRM tools, and advanced automation. Paid plans include a{" "}
                <strong>14-day free trial</strong> (card required; cancel anytime).
              </p>
              <div className="mt-4 inline-flex rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white">
                Current plan: {currentPlan}
              </div>
            </>
          ) : (
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-600 md:text-lg">
              Choose a plan to get started. Paid plans include a <strong>14-day free trial</strong>{" "}
              (card required; cancel anytime during the trial). Unlock more CMA reports, higher lead capacity, stronger
              CRM tools, and advanced automation.
            </p>
          )}
        </div>

        {error && (
          <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.key;

            return (
              <div
                key={plan.key}
                className={[
                  "flex flex-col rounded-3xl border bg-white p-6 shadow-sm",
                  plan.featured ? "border-gray-900 ring-1 ring-gray-900" : "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold text-gray-900">{plan.name}</h2>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-semibold tracking-tight text-gray-900">
                        {plan.price}
                      </span>
                      {plan.priceUnit ? (
                        <span className="text-xs text-gray-500">{plan.priceUnit}</span>
                      ) : null}
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

                {plan.coachingBadge ? (
                  <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-200">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M12 2 L15 8.5 L22 9.5 L17 14.5 L18.5 22 L12 18 L5.5 22 L7 14.5 L2 9.5 L9 8.5 Z" />
                    </svg>
                    {plan.coachingBadge}
                  </div>
                ) : null}

                <ul className="mt-5 flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="rounded-lg bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-700"
                    >
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-5">
                  {plan.ctaHref ? (
                    <a
                      href={plan.ctaHref}
                      className="block w-full rounded-2xl bg-gray-900 px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-gray-800"
                    >
                      {plan.cta}
                    </a>
                  ) : plan.key === "starter" ? (
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

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-gray-50 p-5">
              <div className="text-sm font-semibold text-gray-900">Starter</div>
              <p className="mt-2 text-sm text-gray-600">
                Best for testing the workspace and getting your first leads organized.
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-5">
              <div className="text-sm font-semibold text-gray-900">Agent Pro</div>
              <p className="mt-2 text-sm text-gray-600">
                Best for solo agents actively converting leads. Includes Producer Track coaching.
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-5">
              <div className="text-sm font-semibold text-gray-900">Agent Premium</div>
              <p className="mt-2 text-sm text-gray-600">
                Best for solo top producers wanting unlimited everything + Top Producer Track coaching.
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-5">
              <div className="text-sm font-semibold text-gray-900">Team</div>
              <p className="mt-2 text-sm text-gray-600">
                Best for brokerages with up to 5 agents sharing leads, routing, and team-wide coaching.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-5 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">LeadSmart AI Coaching — built into the product, not an add-on</p>
            <p className="mt-1.5 text-slate-700">
              Every paid plan auto-enrolls in our coaching programs:
              <strong className="ml-1">Producer Track</strong> on Pro
              (target: 10 transactions / 3% conversion) and{" "}
              <strong>Top Producer Track</strong> on Premium and Team
              (target: 15 transactions / 5% conversion). No upsell —
              the daily action plan, peer benchmarks, and AI deep-dives
              are part of the price.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
