"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BillingStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete";

type BillingPlan =
  | "consumer_free"
  | "consumer_premium"
  | "agent_starter"
  | "agent_pro"
  | "loan_broker_pro";

type BillingRecord = {
  id: string;
  role: string;
  plan: BillingPlan;
  status: BillingStatus;
  amount_monthly: number;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  billing_provider: string;
};

const PREMIUM_CHECKOUT_KEY = "price_consumer_premium";

/** Active PropertyTools Premium (Stripe) subscription. */
function isPremiumPlanActive(billing: BillingRecord | null): boolean {
  if (!billing || billing.plan !== "consumer_premium") return false;
  return ["active", "trialing", "past_due"].includes(billing.status);
}

/** Free card is "current" when user is not on an active Premium sub for this product. */
function isFreePlanCurrent(billing: BillingRecord | null): boolean {
  if (isPremiumPlanActive(billing)) return false;
  if (!billing) return true;
  if (billing.plan === "consumer_free") return true;
  if (["canceled", "incomplete"].includes(billing.status)) return true;
  return false;
}

/** Another paid plan (e.g. agent) is active — neither Free nor Premium card is the canonical "current". */
function hasOtherActivePaidPlan(billing: BillingRecord | null): boolean {
  if (!billing) return false;
  if (billing.plan === "consumer_premium" || billing.plan === "consumer_free") return false;
  return ["active", "trialing", "past_due"].includes(billing.status);
}

function planLabel(plan: BillingPlan) {
  switch (plan) {
    case "consumer_free":
      return "Free";
    case "consumer_premium":
      return "Premium";
    case "agent_starter":
      return "Agent Starter";
    case "agent_pro":
      return "Agent Pro";
    case "loan_broker_pro":
      return "Loan Broker Pro";
    default:
      return plan;
  }
}

export default function AccountBillingClientPage() {
  const [billing, setBilling] = useState<BillingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");

  const premiumActive = isPremiumPlanActive(billing);
  const freeCurrent = isFreePlanCurrent(billing);
  const otherPlan = hasOtherActivePaidPlan(billing);

  async function loadBilling() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/account/billing", {
        cache: "no-store",
        credentials: "include",
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        billing?: BillingRecord | null;
      };

      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "Failed to load billing");
      }

      setBilling(json.billing ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBilling();
  }, []);

  async function openPortal() {
    try {
      setPortalLoading(true);
      setError("");

      const res = await fetch("/api/billing/create-portal-session", {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as { success?: boolean; error?: string; url?: string };

      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "Failed to open billing portal");
      }

      if (!json.url) throw new Error("No portal URL returned.");
      window.location.href = json.url;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to open billing portal"
      );
    } finally {
      setPortalLoading(false);
    }
  }

  async function startPremiumCheckout() {
    try {
      setCheckoutLoading(true);
      setError("");

      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ priceId: PREMIUM_CHECKOUT_KEY }),
      });

      const json = (await res.json()) as { success?: boolean; error?: string; url?: string };

      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "Failed to start checkout");
      }

      if (!json.url) throw new Error("No checkout URL returned.");
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/"
            className="text-sm font-medium text-[#0066b3] hover:underline"
          >
            ← Back
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Billing & subscription</h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600">
            Choose your PropertyTools AI plan. Payments are processed securely with Stripe.
          </p>
        </div>
        <Link
          href="/account/profile"
          className="shrink-0 text-sm font-medium text-[#0066b3] hover:underline sm:pt-9"
        >
          My profile →
        </Link>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          Loading…
        </div>
      ) : (
        <div className="space-y-6">
          {otherPlan && billing ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Your account has an active <span className="font-semibold">{planLabel(billing.plan)}</span>{" "}
              subscription. To change or cancel, use{" "}
              <button
                type="button"
                onClick={() => void openPortal()}
                className="font-semibold text-[#0066b3] underline hover:no-underline"
                disabled={portalLoading}
              >
                Manage billing
              </button>
              .
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Free */}
            <div
              className={`relative flex flex-col rounded-xl border bg-white p-6 shadow-sm transition ${
                freeCurrent && !otherPlan
                  ? "border-[#0066b3] ring-2 ring-[#0066b3]/25"
                  : "border-slate-200"
              }`}
            >
              {freeCurrent && !otherPlan ? (
                <span className="absolute right-4 top-4 rounded-full bg-[#0066b3] px-2.5 py-0.5 text-xs font-semibold text-white">
                  Current plan
                </span>
              ) : null}
              <h2 className="text-lg font-semibold text-slate-900">Free</h2>
              <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                $0
                <span className="text-base font-normal text-slate-600">/mo</span>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Core PropertyTools AI features for personal use.
              </p>
              <div className="mt-6 flex flex-1 flex-col justify-end">
                {freeCurrent && !otherPlan ? (
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-500"
                  >
                    Your plan
                  </button>
                ) : premiumActive ? (
                  <button
                    type="button"
                    onClick={() => void openPortal()}
                    disabled={portalLoading}
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                  >
                    {portalLoading ? "Opening…" : "Change plan in portal"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void openPortal()}
                    disabled={portalLoading}
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                  >
                    {portalLoading ? "Opening…" : "Manage in billing portal"}
                  </button>
                )}
              </div>
            </div>

            {/* Premium */}
            <div
              className={`relative flex flex-col rounded-xl border bg-white p-6 shadow-sm transition ${
                premiumActive
                  ? "border-[#0066b3] ring-2 ring-[#0066b3]/25"
                  : "border-slate-200"
              }`}
            >
              {premiumActive ? (
                <span className="absolute right-4 top-4 rounded-full bg-[#0066b3] px-2.5 py-0.5 text-xs font-semibold text-white">
                  Current plan
                </span>
              ) : null}
              <h2 className="text-lg font-semibold text-slate-900">Premium</h2>
              <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                $19
                <span className="text-base font-normal text-slate-600">/mo</span>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Full access to PropertyTools AI — priority usage and advanced features.
              </p>
              <div className="mt-6 flex flex-1 flex-col justify-end">
                {premiumActive ? (
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-500"
                  >
                    Your plan
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void startPremiumCheckout()}
                    disabled={checkoutLoading || otherPlan}
                    title={
                      otherPlan
                        ? "Use Manage billing to change an existing subscription"
                        : undefined
                    }
                    className="w-full rounded-lg bg-[#0066b3] py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:opacity-100"
                  >
                    {checkoutLoading ? "Redirecting…" : "Upgrade to Premium"}
                  </button>
                )}
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-slate-600">
            <button
              type="button"
              onClick={() => void openPortal()}
              disabled={portalLoading}
              className="font-medium text-[#0066b3] underline hover:no-underline disabled:opacity-60"
            >
              {portalLoading ? "Opening…" : "Manage billing — invoices, payment method, cancel"}
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
