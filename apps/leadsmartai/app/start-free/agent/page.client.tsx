"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { PLAN_CATALOG } from "@/lib/entitlements/planCatalog";
import { messageFromUnknownError } from "@/lib/supabaseThrow";
import type { AgentPlanId } from "@/lib/entitlements/types";

const PLANS: {
  id: AgentPlanId;
  price: string;
  subtitle: string;
  checkoutPlan?: "pro" | "premium";
  featured?: boolean;
}[] = [
  { id: "starter", price: "Free", subtitle: "Get started instantly" },
  { id: "growth", price: "$49/mo", subtitle: "14-day free trial", checkoutPlan: "pro", featured: true },
  { id: "elite", price: "$99/mo", subtitle: "14-day free trial", checkoutPlan: "premium" },
];

export default function StartFreeAgentClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleStarter() {
    setError(null);
    setLoading("starter");
    try {
      const res = await fetch("/api/agent/start-free", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "starter" }),
      });
      const json = (await res.json()) as { ok?: boolean; success?: boolean; error?: unknown; redirectTo?: string };
      if (!res.ok || !(json.ok ?? json.success)) {
        throw new Error(messageFromUnknownError(json.error, "Could not activate. Try again."));
      }
      router.push(json.redirectTo || "/agent/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(null);
    }
  }

  async function handlePaid(checkoutPlan: "pro" | "premium") {
    setError(null);
    setLoading(checkoutPlan);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: checkoutPlan, cancel_surface: "agent" }),
      });
      const json = (await res.json()) as { url?: string; ok?: boolean; success?: boolean; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? "Could not start checkout. Try again.");
      }
      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(null);
    }
  }

  function handleSelect(plan: (typeof PLANS)[number]) {
    if (plan.checkoutPlan) {
      void handlePaid(plan.checkoutPlan);
    } else {
      void handleStarter();
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Welcome to LeadSmart AI
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Choose your plan
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
          Pick a plan to unlock your CRM, AI tools, and lead pipeline. Start free or go straight to a paid plan with a
          14-day trial (cancel anytime).
        </p>

        {error && (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>
        )}

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const catalog = PLAN_CATALOG[plan.id];
            const isLoading =
              loading === plan.id || (plan.checkoutPlan ? loading === plan.checkoutPlan : false);

            return (
              <div
                key={plan.id}
                className={`flex flex-col rounded-2xl border p-6 shadow-sm ${
                  plan.featured
                    ? "border-slate-900 ring-2 ring-slate-900/10"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{catalog.label}</h3>
                    <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{plan.price}</div>
                    <p className="mt-1 text-xs text-slate-500">{plan.subtitle}</p>
                  </div>
                  {plan.featured && (
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Popular
                    </span>
                  )}
                </div>

                <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-700">
                  {catalog.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={!!loading}
                  onClick={() => handleSelect(plan)}
                  className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-sm transition disabled:opacity-60 ${
                    plan.featured
                      ? "bg-slate-900 text-white hover:bg-slate-800"
                      : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <>
                      {plan.checkoutPlan ? "Start 14-day trial" : "Get started free"}
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-center text-sm text-slate-500">
          All paid plans include a 14-day free trial. Cancel anytime.
        </p>

        <div className="mt-8 text-center text-sm text-slate-600">
          Questions? See{" "}
          <Link href="/agent/pricing" className="font-semibold text-blue-700 hover:text-blue-800">
            full pricing details
          </Link>
          .
        </div>
      </div>
    </div>
  );
}
