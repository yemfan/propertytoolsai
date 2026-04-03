"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

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
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Not signed in");
        return;
      }
      const { data } = await supabase
        .from("leadsmart_users")
        .select("plan,subscription_status")
        .eq("user_id", user.id)
        .maybeSingle();
      setPlan((data as { plan?: string } | null)?.plan ?? null);
      setStatus((data as { subscription_status?: string } | null)?.subscription_status ?? null);
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-sky-700">LeadSmart AI</p>
        <h1 className="mt-1 text-center text-xl font-bold text-gray-900">Account & billing</h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Manage your subscription, payment method, and invoices in Stripe.
        </p>

        {loading ? (
          <p className="mt-6 text-center text-sm text-gray-500">Loading…</p>
        ) : (
          <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-800">
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
                <Link href="/pricing" className="font-semibold text-sky-700 underline">
                  View plans
                </Link>
              </>
            ) : null}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            disabled={opening}
            onClick={() => void openStripePortal()}
            className="w-full rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
          >
            {opening ? "Opening…" : "Open billing portal"}
          </button>
          <Link
            href="/dashboard"
            className="w-full rounded-xl border border-gray-200 bg-gray-100 py-3 text-center text-sm font-semibold text-gray-900 hover:bg-gray-200"
          >
            Go to dashboard
          </Link>
          <Link
            href="/pricing"
            className="w-full rounded-xl py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Pricing & upgrades
          </Link>
        </div>
      </div>
    </div>
  );
}
