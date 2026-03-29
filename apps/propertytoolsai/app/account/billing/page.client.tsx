"use client";

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function planLabel(plan: BillingPlan) {
  switch (plan) {
    case "consumer_free":
      return "Consumer Free";
    case "consumer_premium":
      return "Consumer Premium";
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

function statusClass(status: BillingStatus) {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700";
    case "trialing":
      return "bg-blue-50 text-blue-700";
    case "past_due":
      return "bg-red-50 text-red-700";
    case "canceled":
      return "bg-gray-100 text-gray-700";
    case "incomplete":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

const PLAN_OPTIONS: Array<{
  label: string;
  plan: BillingPlan;
  priceText: string;
  priceId?: string;
}> = [
  {
    label: "Consumer Premium",
    plan: "consumer_premium",
    priceText: "$19/mo",
    priceId: "price_consumer_premium",
  },
  {
    label: "Agent Starter",
    plan: "agent_starter",
    priceText: "$49/mo",
    priceId: "price_agent_starter",
  },
  {
    label: "Agent Pro",
    plan: "agent_pro",
    priceText: "$99/mo",
    priceId: "price_agent_pro",
  },
  {
    label: "Loan Broker Pro",
    plan: "loan_broker_pro",
    priceText: "$99/mo",
    priceId: "price_loan_broker_pro",
  },
];

export default function AccountBillingClientPage() {
  const [billing, setBilling] = useState<BillingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string>("");
  const [error, setError] = useState("");

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

  async function startCheckout(priceId: string) {
    try {
      setCheckoutLoading(priceId);
      setError("");

      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ priceId }),
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
      setCheckoutLoading("");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            Billing
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your plan, payments, and subscription settings.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-gray-500 shadow-sm">
            Loading billing details...
          </div>
        ) : (
          <>
            <section className="rounded-2xl border bg-white shadow-sm">
              <div className="border-b p-5">
                <h2 className="text-lg font-semibold text-gray-900">
                  Current Subscription
                </h2>
              </div>

              <div className="grid gap-6 p-5 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-500">Current Plan</div>
                    <div className="mt-1 text-2xl font-semibold text-gray-900">
                      {billing ? planLabel(billing.plan) : "Free Plan"}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">Status</div>
                    <div className="mt-2">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          billing ? statusClass(billing.status) : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {billing ? billing.status.replace("_", " ") : "free"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">Monthly Price</div>
                    <div className="mt-1 text-lg font-medium text-gray-900">
                      {billing ? formatCurrency(billing.amount_monthly) : "$0"}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-500">Current Period Start</div>
                    <div className="mt-1 text-base text-gray-900">
                      {billing ? formatDate(billing.current_period_start) : "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">Current Period End</div>
                    <div className="mt-1 text-base text-gray-900">
                      {billing ? formatDate(billing.current_period_end) : "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">Renewal</div>
                    <div className="mt-1 text-base text-gray-900">
                      {billing?.cancel_at_period_end
                        ? "Cancels at period end"
                        : "Auto-renewing"}
                    </div>
                  </div>
                </div>
              </div>

              {billing?.status === "past_due" && (
                <div className="border-t bg-red-50 px-5 py-4 text-sm text-red-700">
                  Your billing status is past due. Please update your payment method.
                </div>
              )}

              {billing?.cancel_at_period_end && (
                <div className="border-t bg-amber-50 px-5 py-4 text-sm text-amber-700">
                  Your subscription is set to cancel at the end of the current billing period.
                </div>
              )}
            </section>

            <section className="rounded-2xl border bg-white shadow-sm">
              <div className="border-b p-5">
                <h2 className="text-lg font-semibold text-gray-900">
                  Available Plans
                </h2>
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-2">
                {PLAN_OPTIONS.map((plan) => {
                  const isCurrent = billing?.plan === plan.plan;

                  return (
                    <div
                      key={plan.plan}
                      className="rounded-2xl border p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold text-gray-900">
                            {plan.label}
                          </div>
                          <div className="mt-1 text-sm text-gray-500">
                            {plan.priceText}
                          </div>
                        </div>

                        {isCurrent && (
                          <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white">
                            Current
                          </span>
                        )}
                      </div>

                      <div className="mt-5">
                        <button
                          type="button"
                          disabled={isCurrent || !plan.priceId || checkoutLoading === plan.priceId}
                          onClick={() => plan.priceId && void startCheckout(plan.priceId)}
                          className="w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                          {isCurrent
                            ? "Current Plan"
                            : checkoutLoading === plan.priceId
                            ? "Redirecting..."
                            : "Choose Plan"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border bg-white shadow-sm">
              <div className="border-b p-5">
                <h2 className="text-lg font-semibold text-gray-900">
                  Billing Management
                </h2>
              </div>

              <div className="p-5">
                <button
                  type="button"
                  onClick={() => void openPortal()}
                  disabled={portalLoading}
                  className="rounded-2xl border px-5 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                >
                  {portalLoading ? "Opening..." : "Manage Subscription"}
                </button>

                <p className="mt-3 text-sm text-gray-500">
                  Update payment methods, download invoices, or cancel your plan in the billing portal.
                </p>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
