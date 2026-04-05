"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BillingStatus = "active" | "trialing" | "past_due" | "canceled" | "incomplete";
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

type Invoice = {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  pdf: string | null;
};

type PaymentMethod = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

const BRAND = "#0072CE";

const PLAN_META: Record<
  BillingPlan,
  { label: string; price: number | null; color: string; features: string[] }
> = {
  consumer_free: {
    label: "Free",
    price: 0,
    color: "#64748b",
    features: [
      "Home value estimates",
      "Property comparisons",
      "AI chat (limited)",
      "Basic market insights",
    ],
  },
  consumer_premium: {
    label: "Premium",
    price: 19,
    color: BRAND,
    features: [
      "Everything in Free",
      "Unlimited AI usage",
      "Priority support",
      "Advanced analytics",
      "Full report access",
    ],
  },
  agent_starter: {
    label: "Agent Starter",
    price: 49,
    color: "#7c3aed",
    features: ["Agent dashboard", "Lead management", "AI replies", "CRM basics"],
  },
  agent_pro: {
    label: "Agent Pro",
    price: 99,
    color: "#dc2626",
    features: ["All Starter features", "Automation", "Predictions", "Priority AI"],
  },
  loan_broker_pro: {
    label: "Loan Broker Pro",
    price: 149,
    color: "#d97706",
    features: ["Broker CRM", "Lead routing", "Full AI suite", "Analytics"],
  },
};

function statusBadge(status: BillingStatus) {
  const map: Record<BillingStatus, { label: string; bg: string; text: string }> = {
    active: { label: "Active", bg: "#dcfce7", text: "#166534" },
    trialing: { label: "Trial", bg: "#dbeafe", text: "#1e40af" },
    past_due: { label: "Past due", bg: "#fef9c3", text: "#854d0e" },
    canceled: { label: "Canceled", bg: "#f1f5f9", text: "#475569" },
    incomplete: { label: "Incomplete", bg: "#fee2e2", text: "#991b1b" },
  };
  const s = map[status] ?? map.incomplete;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function CardBrandIcon({ brand }: { brand: string }) {
  const b = brand.toLowerCase();
  const color =
    b === "visa"
      ? "#1a1f71"
      : b === "mastercard"
        ? "#eb001b"
        : b === "amex"
          ? "#007bc1"
          : "#64748b";
  return (
    <span
      className="inline-flex h-6 w-10 items-center justify-center rounded border border-slate-200 text-[10px] font-bold tracking-wide"
      style={{ color, background: "#f8fafc" }}
    >
      {b === "visa"
        ? "VISA"
        : b === "mastercard"
          ? "MC"
          : b === "amex"
            ? "AMEX"
            : capitalize(brand)}
    </span>
  );
}

function isPremiumActive(b: BillingRecord | null) {
  return b?.plan === "consumer_premium" && ["active", "trialing", "past_due"].includes(b.status);
}

function isFreeCurrent(b: BillingRecord | null) {
  if (isPremiumActive(b)) return false;
  if (!b) return true;
  if (b.plan === "consumer_free") return true;
  if (["canceled", "incomplete"].includes(b.status)) return true;
  return false;
}

function hasOtherPlan(b: BillingRecord | null) {
  if (!b) return false;
  if (b.plan === "consumer_premium" || b.plan === "consumer_free") return false;
  return ["active", "trialing", "past_due"].includes(b.status);
}

export default function AccountBillingClientPage() {
  const [billing, setBilling] = useState<BillingRecord | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");

  const premiumActive = isPremiumActive(billing);
  const freeCurrent = isFreeCurrent(billing);
  const otherPlan = hasOtherPlan(billing);

  async function load() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/account/billing", { cache: "no-store", credentials: "include" });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        billing?: BillingRecord | null;
        invoices?: Invoice[];
        paymentMethod?: PaymentMethod | null;
      };
      if (!res.ok || json?.success === false) throw new Error(json?.error || "Failed to load billing");
      setBilling(json.billing ?? null);
      setInvoices(json.invoices ?? []);
      setPaymentMethod(json.paymentMethod ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function openPortal() {
    try {
      setPortalLoading(true);
      setError("");
      const res = await fetch("/api/billing/create-portal-session", {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as { success?: boolean; error?: string; url?: string };
      if (!res.ok || json?.success === false) throw new Error(json?.error || "Failed to open portal");
      if (!json.url) throw new Error("No portal URL returned.");
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open portal");
    } finally {
      setPortalLoading(false);
    }
  }

  async function startCheckout() {
    try {
      setCheckoutLoading(true);
      setError("");
      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ priceId: "price_consumer_premium" }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string; url?: string };
      if (!res.ok || json?.success === false) throw new Error(json?.error || "Failed to start checkout");
      if (!json.url) throw new Error("No checkout URL returned.");
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setCheckoutLoading(false);
    }
  }

  const meta = billing ? PLAN_META[billing.plan] : null;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/" className="text-sm font-medium text-[#0072ce] hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            Billing &amp; Subscription
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your plan, payment method, and view invoice history.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-1 hidden text-xs font-medium text-slate-400 underline hover:text-slate-600 sm:block"
        >
          Refresh
        </button>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Current subscription card ──────────────────────────────────── */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Coloured accent bar */}
            <div
              className="h-1.5 w-full"
              style={{ background: billing && meta ? meta.color : "#e2e8f0" }}
            />
            <div className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Current plan
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900">
                    {billing && meta ? meta.label : "Free"}
                  </h2>
                  {billing && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {statusBadge(billing.status)}
                      {billing.cancel_at_period_end && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                          Cancels at period end
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <p className="text-3xl font-extrabold text-slate-900">
                    ${billing && billing.amount_monthly > 0 ? billing.amount_monthly.toFixed(0) : "0"}
                  </p>
                  <p className="text-sm text-slate-500">per month</p>
                </div>
              </div>

              {/* Details grid */}
              {billing && (billing.current_period_end || billing.current_period_start || paymentMethod) && (
                <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
                  {billing.current_period_end && (
                    <div>
                      <p className="text-xs text-slate-400">
                        {billing.cancel_at_period_end ? "Cancels on" : "Next billing"}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">
                        {fmt(billing.current_period_end)}
                      </p>
                    </div>
                  )}
                  {billing.current_period_start && (
                    <div>
                      <p className="text-xs text-slate-400">Period started</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">
                        {fmt(billing.current_period_start)}
                      </p>
                    </div>
                  )}
                  {paymentMethod && (
                    <div>
                      <p className="text-xs text-slate-400">Payment method</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <CardBrandIcon brand={paymentMethod.brand} />
                        <span className="text-sm font-semibold text-slate-900">
                          •••• {paymentMethod.last4}
                        </span>
                        <span className="text-xs text-slate-400">
                          {String(paymentMethod.expMonth).padStart(2, "0")}/{paymentMethod.expYear}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Cancel warning */}
              {billing?.cancel_at_period_end && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Your subscription is set to cancel at the end of the billing period.
                  {billing.current_period_end && (
                    <> All features remain available until <strong>{fmt(billing.current_period_end)}</strong>.</>
                  )}
                </div>
              )}

              {/* Portal action */}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void openPortal()}
                  disabled={portalLoading}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {portalLoading ? "Opening…" : "Manage billing →"}
                </button>
                <span className="text-xs text-slate-400">
                  Update card, download invoices, or cancel
                </span>
              </div>
            </div>
          </div>

          {/* ── Other plan notice ──────────────────────────────────────────── */}
          {otherPlan && billing && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              You have an active <strong>{meta?.label ?? billing.plan}</strong> subscription. To
              change or cancel, use{" "}
              <button
                type="button"
                onClick={() => void openPortal()}
                disabled={portalLoading}
                className="font-semibold underline hover:no-underline"
              >
                Manage billing
              </button>
              .
            </div>
          )}

          {/* ── Plan cards ────────────────────────────────────────────────── */}
          <div>
            <h2 className="mb-4 text-lg font-bold text-slate-900">Plans</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Free */}
              <div
                className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                  freeCurrent && !otherPlan
                    ? "border-[#0072ce] ring-2 ring-[#0072ce]/20"
                    : "border-slate-200"
                }`}
              >
                {freeCurrent && !otherPlan && (
                  <span
                    className="absolute right-4 top-4 rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                    style={{ background: BRAND }}
                  >
                    Current plan
                  </span>
                )}
                <p className="text-sm font-semibold text-slate-500">Free</p>
                <p className="mt-1 text-3xl font-extrabold text-slate-900">
                  $0<span className="text-base font-normal text-slate-500">/mo</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
                  {PLAN_META.consumer_free.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="text-slate-400">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {freeCurrent && !otherPlan ? (
                    <button
                      disabled
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-400"
                    >
                      Current plan
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void openPortal()}
                      disabled={portalLoading}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                    >
                      {portalLoading ? "Opening…" : "Manage in portal"}
                    </button>
                  )}
                </div>
              </div>

              {/* Premium */}
              <div
                className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                  premiumActive
                    ? "border-[#0072ce] ring-2 ring-[#0072ce]/20"
                    : "border-slate-200"
                }`}
              >
                {!premiumActive && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span
                      className="rounded-full px-3 py-1 text-xs font-bold text-white shadow-sm"
                      style={{ background: BRAND }}
                    >
                      Most popular
                    </span>
                  </div>
                )}
                {premiumActive && (
                  <span
                    className="absolute right-4 top-4 rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                    style={{ background: BRAND }}
                  >
                    Current plan
                  </span>
                )}
                <p className="text-sm font-semibold" style={{ color: BRAND }}>
                  Premium
                </p>
                <p className="mt-1 text-3xl font-extrabold text-slate-900">
                  $19<span className="text-base font-normal text-slate-500">/mo</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
                  {PLAN_META.consumer_premium.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span style={{ color: BRAND }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {premiumActive ? (
                    <button
                      disabled
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-400"
                    >
                      Current plan
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void startCheckout()}
                      disabled={checkoutLoading || otherPlan}
                      className="w-full rounded-xl py-2.5 text-sm font-bold text-white shadow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ background: BRAND }}
                    >
                      {checkoutLoading ? "Redirecting…" : "Upgrade to Premium"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Payment history ────────────────────────────────────────────── */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Payment history</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Recent charges on your account.
              </p>
            </div>

            {invoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left">
                      <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Date
                      </th>
                      <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Status
                      </th>
                      <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Receipt
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="transition hover:bg-slate-50/70">
                        <td className="px-6 py-3.5 text-slate-700">{fmt(inv.date)}</td>
                        <td className="px-6 py-3.5 font-semibold text-slate-900">
                          {inv.currency} ${inv.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                            style={
                              inv.status === "paid"
                                ? { background: "#dcfce7", color: "#166534" }
                                : inv.status === "open"
                                  ? { background: "#fef9c3", color: "#854d0e" }
                                  : { background: "#f1f5f9", color: "#475569" }
                            }
                          >
                            {capitalize(inv.status)}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          {inv.pdf ? (
                            <a
                              href={inv.pdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium underline hover:no-underline"
                              style={{ color: BRAND }}
                            >
                              Download PDF
                            </a>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <p className="text-sm font-medium text-slate-400">No payments yet</p>
                <p className="mt-1 text-xs text-slate-300">
                  Invoices will appear here after your first payment.
                </p>
              </div>
            )}

            <div className="border-t border-slate-100 px-6 py-3">
              <button
                type="button"
                onClick={() => void openPortal()}
                disabled={portalLoading}
                className="text-xs font-medium underline hover:no-underline disabled:opacity-60"
                style={{ color: BRAND }}
              >
                {portalLoading ? "Opening…" : "View all invoices in Stripe portal →"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
