"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AuthPageShell from "@/components/layout/AuthPageShell";
import Card from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getUsage } from "@/lib/usage";

export default function PortalPage() {
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const u = await getUsage();
      setPlan(u.plan);
      setStatus(u.subscriptionStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load account");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openStripePortal() {
    setOpening(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? "Could not open billing portal");
      }
      if (body.url) {
        window.location.assign(body.url);
        return;
      }
      throw new Error("Missing portal URL");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Portal failed");
    } finally {
      setOpening(false);
    }
  }

  return (
    <AuthPageShell>
      <Card className="mx-auto max-w-lg p-6 sm:p-8">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#0072ce]">
          PropertyTools AI
        </p>
        <h1 className="mt-1 text-center font-heading text-xl font-bold text-slate-900 md:text-2xl">
          Account & billing
        </h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          Manage your subscription, payment method, and invoices in Stripe.
        </p>

        {loading ? (
          <p className="mt-6 text-center text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
            <p>
              <span className="font-semibold">Plan:</span> {plan ?? "—"}
            </p>
            <p className="mt-1">
              <span className="font-semibold">Subscription:</span> {status ?? "—"}
            </p>
          </div>
        )}

        {error ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            {error}
            {error.includes("No Stripe customer") ? (
              <>
                {" "}
                <Link href="/pricing" className="font-semibold text-[#0072ce] underline">
                  View plans
                </Link>
              </>
            ) : null}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          <Button
            type="button"
            className="w-full"
            size="lg"
            disabled={opening}
            onClick={() => void openStripePortal()}
          >
            {opening ? "Opening…" : "Open billing portal"}
          </Button>
          <Button href="/dashboard" variant="secondary" className="w-full" size="lg">
            Go to dashboard
          </Button>
          <Button href="/pricing" variant="ghost" className="w-full" size="lg">
            Pricing & upgrades
          </Button>
        </div>
      </Card>
    </AuthPageShell>
  );
}
