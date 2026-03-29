"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type PlanSlug = "starter" | "pro" | "team";

type Catalog = Record<PlanSlug, { price: number; features: readonly string[] }>;

type SubscriptionPayload = {
  plan: PlanSlug;
  status: string;
  features: readonly string[];
  tier: { price: number; features: readonly string[] };
} | null;

export default function BillingPageClient() {
  const searchParams = useSearchParams();
  const canceled = searchParams.get("canceled") === "1";
  const checkoutOk = searchParams.get("checkout") === "success";
  const checkoutErr = searchParams.get("checkout_error");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionPayload>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [billingPageUrl, setBillingPageUrl] = useState<string | null>(null);
  const [busyPlan, setBusyPlan] = useState<PlanSlug | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/subscription", { credentials: "include" });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        subscription?: SubscriptionPayload;
        catalog?: Catalog;
        billingPageUrl?: string | null;
      };
      if (!res.ok || body.ok === false) {
        setError(typeof body.error === "string" ? body.error : "Could not load subscription");
        return;
      }
      setSubscription(body.subscription ?? null);
      setCatalog(body.catalog ?? null);
      setBillingPageUrl(typeof body.billingPageUrl === "string" ? body.billingPageUrl : null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startCheckout = async (plan: PlanSlug) => {
    setBusyPlan(plan);
    setError(null);
    try {
      const res = await fetch("/api/billing/crm-checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || body.ok === false || !body.url) {
        setError(typeof body.error === "string" ? body.error : "Checkout failed");
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Could not start checkout");
    } finally {
      setBusyPlan(null);
    }
  };

  const openPortal = async () => {
    setPortalBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        setError(typeof body.error === "string" ? body.error : "Portal unavailable");
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Could not open billing portal");
    } finally {
      setPortalBusy(false);
    }
  };

  const tiers: { id: PlanSlug; title: string; hint: string }[] = [
    { id: "starter", title: "Starter", hint: "Core CRM + limited AI" },
    { id: "pro", title: "Pro", hint: "Full AI, automation, predictions" },
    { id: "team", title: "Team", hint: "Multi-agent & routing (foundation)" },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="ui-page-title text-brand-text">Billing</h1>
        <p className="ui-page-subtitle text-brand-text/80">
          Monthly CRM subscription via Stripe. Manage payment method and invoices in the customer portal.
        </p>
      </div>

      {canceled ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Checkout was canceled — pick a plan when you&apos;re ready.
        </div>
      ) : null}
      {checkoutOk ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Subscription updated. It may take a few seconds for features to unlock everywhere.
        </div>
      ) : null}
      {checkoutErr ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          Checkout could not complete ({checkoutErr}). Try again or contact support.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      ) : null}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold text-brand-text mb-2">Current plan</h2>
        {loading ? (
          <p className="text-sm text-gray-600">Loading…</p>
        ) : subscription ? (
          <dl className="text-sm text-gray-700 space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Plan</dt>
              <dd className="font-semibold capitalize">{subscription.plan}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Status</dt>
              <dd className="font-semibold">{subscription.status}</dd>
            </div>
            <div>
              <dt className="text-gray-500 mb-1">Features</dt>
              <dd>
                <ul className="list-disc pl-5 space-y-1">
                  {subscription.features.map((f) => (
                    <li key={f} className="font-mono text-xs">
                      {f}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-gray-600">
            No active CRM subscription. Choose a plan below to unlock AI and automation features.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void openPortal()}
            disabled={portalBusy}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {portalBusy ? "Opening…" : "Customer portal"}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {tiers.map((t) => {
          const row = catalog?.[t.id];
          const price = row?.price ?? "—";
          return (
            <div key={t.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 flex flex-col">
              <h3 className="text-base font-bold text-brand-text">{t.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{t.hint}</p>
              <p className="mt-4 text-2xl font-extrabold text-brand-text">
                {typeof price === "number" ? `$${price}` : price}
                {typeof price === "number" ? <span className="text-sm font-normal text-gray-500">/mo</span> : null}
              </p>
              <ul className="mt-3 text-xs text-gray-600 space-y-1 flex-1">
                {(row?.features ?? []).map((f) => (
                  <li key={f}>• {f.replace(/_/g, " ")}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => void startCheckout(t.id)}
                disabled={busyPlan !== null}
                className="mt-4 w-full rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {busyPlan === t.id ? "Redirecting…" : "Subscribe"}
              </button>
            </div>
          );
        })}
      </div>

      {billingPageUrl ? (
        <div className="text-xs text-gray-500">
          <p className="font-semibold text-gray-700 mb-1">Mobile / external checkout</p>
          <p>
            Open this page in a browser to complete payment (no in-app purchase):{" "}
            <span className="font-mono break-all">{billingPageUrl}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
