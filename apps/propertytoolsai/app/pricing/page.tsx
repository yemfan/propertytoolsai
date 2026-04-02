"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BrandCheck, toneAt } from "@/components/brand/BrandCheck";
import PaywallModal from "@/components/PaywallModal";
import Card from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FeatureHighlightCard, type FeatureHighlightAccent } from "@/components/ui/FeatureHighlightCard";
import { PRICING_TRIAL_CHECKOUT_PATH, loginUrl } from "@/lib/loginUrl";
import { mergeAuthHeaders } from "@/lib/mergeAuthHeaders";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Link from "next/link";

/** Stripe checkout keys (see `create-checkout-session` + `stripePriceIds`). */
type CheckoutPlanKey = "pro" | "premium";

const PRICING_VALUE_HIGHLIGHTS: {
  accent: FeatureHighlightAccent;
  title: string;
  description: string;
}[] = [
  {
    accent: "primary",
    title: "🏠 Home value & CMA intelligence",
    description: "Estimates, comps, and narrative reports tailored to your market.",
  },
  {
    accent: "primaryDark",
    title: "📊 Calculators & affordability",
    description: "Mortgage, refinance, rent vs buy, investment, and more in one place.",
  },
  {
    accent: "success",
    title: "📈 Market trends & insights",
    description: "Trends, snapshots, and data to support smarter buy/sell decisions.",
  },
  {
    accent: "accent",
    title: "🔔 Saved homes & alerts",
    description: "Watch listings and get notified when something important changes.",
  },
];

const plans: (
  | {
      id: string;
      paid: false;
      title: string;
      price: string;
      subtitle: string;
      features: string[];
    }
  | {
      id: string;
      paid: true;
      checkoutKey: CheckoutPlanKey;
      title: string;
      price: string;
      subtitle: string;
      features: string[];
      cta: string;
    }
)[] = [
  {
    id: "consumer-basic",
    paid: false,
    title: "Consumer Basic",
    price: "Free",
    subtitle: "Sign up at no cost — core tools with fair daily limits",
    features: [
      "Home value estimator & AI CMA tools (daily usage limits apply)",
      "All standard calculators: mortgage, affordability, refinance, rent vs buy, closing costs, cap rate, and more",
      "Market reports & value trends (limited exports vs Premium)",
      "Saved searches, shortlists, and standard alerts",
      "Property comparison & listing intelligence (usage caps apply)",
      "Email support",
    ],
  },
  {
    id: "consumer-premium",
    paid: true,
    checkoutKey: "premium",
    title: "Consumer Premium",
    price: "$19/mo",
    subtitle: "Unlimited access to everything PropertyToolsAI offers",
    features: [
      "Unlimited use of every consumer tool and AI feature — no daily caps",
      "Unlimited CMA & home value sessions, reports, and downloads",
      "Unlimited exports, PDFs, and saved analyses",
      "Advanced alerts, automation, and priority notifications where available",
      "Full market analytics and comparison depth — same tools as Basic, without limits",
      "Priority support",
    ],
    cta: "Get Consumer Premium",
  },
];

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<CheckoutPlanKey | null>(null);
  const [trialLoading, setTrialLoading] = useState(false);
  const [planInfo, setPlanInfo] = useState<{
    plan: string;
    access: string;
    subscription_status: string;
    trial_used: boolean;
  } | null>(null);
  const [leadUsage, setLeadUsage] = useState<{ count: number; limit: number | null; plan: string } | null>(null);
  const [cmaUsage, setCmaUsage] = useState<{ used: number; limit: number; reached: boolean; warning: boolean } | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallDismissed, setPaywallDismissed] = useState(false);
  const [paywallMsg, setPaywallMsg] = useState("You’ve reached your limit. Upgrade to continue.");
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const trialCheckoutSentRef = useRef(false);
  const checkoutPlanAutoRef = useRef(false);
  const checkoutErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) {
        setLoggedIn(!!session);
        setAuthReady(true);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
      setAuthReady(true);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const limitsForcePaywall = Boolean(
    (leadUsage && leadUsage.limit != null && leadUsage.count >= leadUsage.limit) || cmaUsage?.reached
  );

  useEffect(() => {
    if (!limitsForcePaywall) setPaywallDismissed(false);
  }, [limitsForcePaywall]);

  /** After login at `/pricing?trial_checkout=1`, open Stripe (Consumer Premium + trial period). */
  useEffect(() => {
    if (!authReady) return;
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("trial_checkout") !== "1") return;
    if (sp.get("canceled") === "1") {
      setTrialLoading(false);
      return;
    }
    if (!loggedIn) {
      window.location.href = loginUrl({ redirect: PRICING_TRIAL_CHECKOUT_PATH, reason: "trial" });
      return;
    }
    if (trialCheckoutSentRef.current) return;
    trialCheckoutSentRef.current = true;

    (async () => {
      setTrialLoading(true);
      setError(null);
      try {
        const headers = await mergeAuthHeaders();
        const res = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ plan: "premium", with_trial: true }),
        });
        const body = (await res.json().catch(() => ({}))) as any;
        if (!res.ok) throw new Error(body?.error || "Failed to open checkout");
        if (!body.url) throw new Error("Missing checkout url");
        window.location.href = body.url;
      } catch (e: any) {
        trialCheckoutSentRef.current = false;
        setError(e?.message ?? "Could not open trial checkout");
        setTrialLoading(false);
      }
    })();
  }, [authReady, loggedIn]);

  useEffect(() => {
    let cancelled = false;
    async function loadDynamic() {
      try {
        const [planRes, leadsRes, cmaRes] = await Promise.all([
          fetch("/api/check-plan", { method: "POST", credentials: "include" }),
          fetch("/api/leads/count", { credentials: "include" }),
          fetch("/api/cma/check-limit", { method: "POST", credentials: "include" }),
        ]);

        const planJson = (await planRes.json().catch(() => ({}))) as any;
        const leadsJson = (await leadsRes.json().catch(() => ({}))) as any;
        const cmaJson = (await cmaRes.json().catch(() => ({}))) as any;

        if (!cancelled) {
          if (planRes.ok && planJson?.ok) {
            setPlanInfo({
              plan: String(planJson.plan ?? "free"),
              access: String(planJson.access ?? "limited"),
              subscription_status: String(planJson.subscription_status ?? "inactive"),
              trial_used: Boolean(planJson.trial_used ?? false),
            });
          }
          if (leadsRes.ok && leadsJson?.ok) {
            setLeadUsage({
              count: Number(leadsJson.count ?? 0),
              limit: leadsJson.limit == null ? null : Number(leadsJson.limit),
              plan: String(leadsJson.plan ?? "free"),
            });
          }
          if (cmaRes.ok && cmaJson?.ok) {
            setCmaUsage({
              used: Number(cmaJson?.usage?.used ?? 0),
              limit: Number(cmaJson?.usage?.limit ?? 0),
              reached: Boolean(cmaJson?.usage?.reached ?? false),
              warning: Boolean(cmaJson?.usage?.warning ?? false),
            });
          }
        }
      } catch {
        // best effort; pricing page still renders static copy
      }
    }
    loadDynamic();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!error) return;
    checkoutErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  const leadsPct = useMemo(() => {
    if (!leadUsage || leadUsage.limit == null || leadUsage.limit <= 0) return 0;
    return Math.min(100, Math.round((leadUsage.count / leadUsage.limit) * 100));
  }, [leadUsage]);

  async function startCheckout(plan: CheckoutPlanKey) {
    setError(null);
    setLoadingPlan(plan);
    try {
      const {
        data: { session },
      } = await supabaseBrowser().auth.getSession();
      if (!session) {
        setLoadingPlan(null);
        window.location.assign(
          loginUrl({ redirect: `/pricing?checkout_plan=${plan}`, reason: "checkout" })
        );
        return;
      }
      const headers = await mergeAuthHeaders();
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers,
        body: JSON.stringify({ plan }),
        credentials: "include",
      });
      const raw = await res.text();
      let body: { error?: string; url?: string } = {};
      try {
        body = raw ? (JSON.parse(raw) as typeof body) : {};
      } catch {
        body = { error: raw.slice(0, 200) || `Request failed (${res.status})` };
      }
      if (!res.ok) {
        throw new Error(
          typeof body.error === "string" && body.error.length > 0
            ? body.error
            : `Checkout failed (${res.status})`
        );
      }
      if (!body.url) throw new Error("Missing checkout URL — check Stripe configuration.");
      window.location.assign(body.url);
    } catch (e: any) {
      setError(e?.message ?? "Checkout failed");
      setLoadingPlan(null);
    }
  }

  /** Deep link: `/pricing?checkout_plan=pro` opens Stripe Checkout after sign-in. */
  useEffect(() => {
    if (!authReady || !loggedIn || checkoutPlanAutoRef.current) return;
    if (typeof window === "undefined") return;
    const plan = new URLSearchParams(window.location.search).get("checkout_plan");
    if (plan !== "pro" && plan !== "premium") return;
    checkoutPlanAutoRef.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout_plan");
    const q = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${q ? `?${q}` : ""}`);
    void startCheckout(plan as "pro" | "premium");
  }, [authReady, loggedIn]);

  async function startTrial() {
    setError(null);
    setTrialLoading(true);
    try {
      const {
        data: { session },
      } = await supabaseBrowser().auth.getSession();
      if (!session) {
        window.location.href = loginUrl({ redirect: PRICING_TRIAL_CHECKOUT_PATH, reason: "trial" });
        return;
      }
      const headers = await mergeAuthHeaders();
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ plan: "premium", with_trial: true }),
      });
      const body = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw new Error(body?.error || "Failed to open checkout");
      if (!body.url) throw new Error("Missing checkout url");
      window.location.href = body.url;
    } catch (e: any) {
      setError(e?.message ?? "Could not open trial checkout");
    } finally {
      setTrialLoading(false);
    }
  }

  return (
    <div className="relative mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <div
        className="pointer-events-none absolute inset-x-0 -top-4 h-64 opacity-[0.35]"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 80% at 50% 0%, rgba(0,114,206,0.14), transparent 55%)",
        }}
      />
      {error ? (
        <div
          ref={checkoutErrorRef}
          role="alert"
          className="sticky top-2 z-20 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 shadow-md"
        >
          {error}
        </div>
      ) : null}
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-sky-50/40 p-6 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.04] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0072ce]">Pricing</p>
        <h1 className="font-heading mt-2 max-w-4xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Two simple plans for buyers and sellers
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-700 sm:text-base">
          <span className="font-semibold text-slate-800">Consumer Basic</span> is free — create an account and use our
          tools with fair usage limits. <span className="font-semibold text-slate-800">Consumer Premium</span> unlocks
          unlimited access to every feature.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="button"
            size="lg"
            onClick={startTrial}
            disabled={trialLoading || Boolean(planInfo?.trial_used)}
          >
            {trialLoading
              ? "Starting…"
              : authReady && !loggedIn
                ? "Sign in to try Premium free"
                : "🚀 Try Premium free (trial)"}
          </Button>
          <Button href={loggedIn ? "/dashboard" : "/signup"} variant="outline" size="lg">
            {loggedIn ? "Open dashboard" : "Start with Basic (free)"}
          </Button>
          <Button href="#plans" variant="outline" size="lg">
            📊 See plans
          </Button>
        </div>
        {authReady && !loggedIn ? (
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-slate-600">
            The Premium trial opens secure Stripe checkout after you{" "}
            <Link href="/signup" className="font-semibold text-[#0072ce] hover:underline">
              sign up
            </Link>{" "}
            or{" "}
            <Link href={loginUrl({ redirect: PRICING_TRIAL_CHECKOUT_PATH, reason: "trial" })} className="font-semibold text-[#0072ce] hover:underline">
              sign in
            </Link>
            .
          </p>
        ) : null}
        <p className="mt-4 text-xs text-slate-600">Trusted by thousands of home buyers and sellers</p>
      </section>

      {/* Value props — LeadSmart AI-style top-accent feature cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PRICING_VALUE_HIGHLIGHTS.map((item) => (
          <FeatureHighlightCard
            key={item.title}
            accent={item.accent}
            title={item.title}
            description={item.description}
            className="p-4 sm:p-5"
          />
        ))}
      </section>

      {/* Dynamic usage / upgrade hooks */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="text-sm font-semibold text-slate-900">Lead usage</div>
          <div className="mt-2 text-xs text-slate-700">
            {leadUsage
              ? leadUsage.limit == null
                ? `Leads: ${leadUsage.count} / Unlimited`
                : `Leads: ${leadUsage.count} / ${leadUsage.limit}`
              : "Leads: —"}
          </div>
          {leadUsage && leadUsage.limit != null ? (
            <>
              <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full ${leadsPct >= 100 ? "bg-red-500" : leadsPct >= 90 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${leadsPct}%` }}
                />
              </div>
              {leadsPct >= 90 && leadsPct < 100 ? (
                <div className="mt-2 text-xs font-semibold text-amber-700">
                  You’re close to your lead limit
                </div>
              ) : null}
              {leadsPct >= 100 ? (
                <div className="mt-2 text-xs text-red-700 font-semibold">
                  You’ve reached your CMA or Lead limit. Upgrade to Consumer Premium for unlimited access.
                </div>
              ) : null}
            </>
          ) : null}
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold text-slate-900">CMA usage</div>
          <div className="mt-2 text-xs text-slate-700">
            {cmaUsage ? `You have used ${cmaUsage.used}/${cmaUsage.limit} CMA reports today` : "CMA usage: —"}
          </div>
          {cmaUsage?.warning && !cmaUsage.reached ? (
            <div className="mt-2 text-xs text-amber-700 font-semibold">
              ⚠️ You’re almost out of free CMA reports
            </div>
          ) : null}
          {cmaUsage?.reached ? (
            <div className="mt-2 text-xs text-red-700 font-semibold">
              You’ve reached your CMA or Lead limit. Upgrade to Consumer Premium for unlimited access.
            </div>
          ) : null}
        </Card>
      </section>

      {/* Pricing table */}
      <section id="plans" className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {plans.map((p) => (
          <Card
            key={p.id}
            className={`p-6 ${
              p.id === "consumer-premium" ? "border-[#0072ce]/35 ring-2 ring-[#0072ce]/15" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {p.title}
              </div>
              {p.id === "consumer-premium" ? (
                <span className="inline-flex items-center rounded-full bg-[#0072ce]/10 px-2 py-1 text-[10px] font-bold text-[#005ca8]">
                  Unlimited everything
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">
                  Free forever
                </span>
              )}
            </div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {p.price}
            </div>
            <div className="mt-1 text-xs text-gray-500">{p.subtitle}</div>
            <ul className="mt-5 space-y-2 text-sm text-gray-700">
              {p.features.map((f, i) => (
                <li key={`${p.id}-${i}`} className="flex items-start gap-2">
                  <BrandCheck tone={toneAt(i)} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 space-y-2">
              {p.paid && p.id === "consumer-premium" ? (
                <button
                  type="button"
                  onClick={() => startCheckout(p.checkoutKey)}
                  disabled={loadingPlan === p.checkoutKey}
                  className="w-full rounded-xl bg-[#0072ce] py-2.5 font-semibold text-white shadow-sm hover:bg-[#005ca8] disabled:opacity-60"
                >
                  {loadingPlan === p.checkoutKey ? "Redirecting…" : p.cta}
                </button>
              ) : !p.paid ? (
                <Link
                  href={loggedIn ? "/dashboard" : "/signup"}
                  className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
                >
                  {loggedIn ? "Open dashboard" : "Sign up free"}
                </Link>
              ) : null}
              {p.paid && p.id === "consumer-premium" ? (
                <button
                  type="button"
                  onClick={startTrial}
                  disabled={trialLoading || Boolean(planInfo?.trial_used)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                >
                  {trialLoading ? "Starting…" : "Start 7-day Premium trial"}
                </button>
              ) : null}
            </div>
            {p.id === "consumer-basic" &&
            leadUsage?.limit != null &&
            leadsPct >= 90 ? (
              <div className="mt-3 text-[11px] text-amber-700 font-medium">
                {leadsPct >= 100
                  ? "You’ve reached your Basic usage limits. Consumer Premium includes unlimited access."
                  : "You’re close to your Basic limits — Consumer Premium includes unlimited access."}
              </div>
            ) : null}
          </Card>
        ))}
      </section>

      {/* CTA section */}
      <Card className="p-6 sm:p-8">
        <h2 className="font-heading text-2xl font-bold text-slate-900">
          Ready to unlock smarter buy &amp; sell decisions?
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-700">
          Use <span className="font-semibold">Consumer Basic</span> free with an account, or try{" "}
          <span className="font-semibold">Consumer Premium</span> with a 7-day trial / subscription for unlimited access.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button href={loggedIn ? "/dashboard" : "/signup"} variant="outline" size="lg">
            {loggedIn ? "Open dashboard" : "Start free (Basic)"}
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={startTrial}
            disabled={trialLoading || Boolean(planInfo?.trial_used)}
          >
            {trialLoading
              ? "Starting…"
              : authReady && !loggedIn
                ? "Sign in to try Premium free"
                : "🚀 Try Premium free (trial)"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => startCheckout("premium")}
            disabled={loadingPlan === "premium"}
          >
            ✨ Subscribe to Premium
          </Button>
        </div>
        {authReady && !loggedIn ? (
          <p className="mt-3 max-w-2xl text-xs text-slate-600">
            Upgrade requires an account — you’ll be asked to sign in before checkout.
          </p>
        ) : null}
      </Card>

      {/* Testimonials / social proof */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          "“Finally understood what our home was worth before we talked to an agent.” — Sarah K., Seller",
          "“The affordability and mortgage tools made our first buy way less stressful.” — Michael T., Buyer",
          "“Upgraded to Premium and stopped hitting limits on reports — worth it.” — Ariana P., Investor",
        ].map((q) => (
          <Card key={q} variant="muted" className="p-4 text-sm text-slate-700">
            {q}
          </Card>
        ))}
      </section>

      <Card variant="muted" className="p-4 text-sm text-slate-700">
        <span className="font-semibold">Thousands of consumers</span> ·{" "}
        <span className="font-semibold">Millions of calculator runs</span> ·{" "}
        <span className="font-semibold">Reports &amp; estimates every day</span>
      </Card>

      <PaywallModal
        open={(paywallOpen || limitsForcePaywall) && !paywallDismissed}
        onClose={() => {
          setPaywallOpen(false);
          setPaywallDismissed(true);
        }}
        message={paywallMsg}
        ctaLabel="Upgrade Now"
        onPrimaryClick={() => startCheckout("premium")}
      />
    </div>
  );
}

