"use client";

import { useEffect, useMemo, useState } from "react";
import { BrandCheck, toneAt } from "@/components/brand/BrandCheck";
import PaywallModal from "@/components/PaywallModal";
import Card from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FeatureHighlightCard, type FeatureHighlightAccent } from "@/components/ui/FeatureHighlightCard";

type Plan = "free" | "pro" | "premium";

const PRICING_VALUE_HIGHLIGHTS: {
  accent: FeatureHighlightAccent;
  title: string;
  description: string;
}[] = [
  {
    accent: "primary",
    title: "⚡ Instant AI CMA Reports",
    description: "Professional comps and narrative in minutes, not hours.",
  },
  {
    accent: "primaryDark",
    title: "🤖 Lead Management & Automation",
    description: "Pipeline, follow-ups, and engagement in one workflow.",
  },
  {
    accent: "success",
    title: "🔔 Alerts & Market Updates",
    description: "Stay ahead when leads engage or limits approach.",
  },
  {
    accent: "accent",
    title: "📁 CRM & Reports in one place",
    description: "Exports and context your team can actually use.",
  },
  {
    accent: "primary",
    title: "📈 Flexible plans for every agent",
    description: "From solo to team — scale without replatforming.",
  },
];

const plans: {
  key: Plan;
  title: string;
  price: string;
  subtitle: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}[] = [
  {
    key: "free",
    title: "Free",
    price: "$0/mo",
    subtitle: "Best for testing the workflow",
    features: [
      "CMA Reports: 2/day",
      "Lead Management: No CRM access",
      "Alerts: Basic",
      "CRM Access: No",
      "Reports Download: Limited",
      "Team Access: No",
    ],
    cta: "Get Started Free",
  },
  {
    key: "pro",
    title: "Pro Agent",
    price: "$49/mo",
    subtitle: "For active solo agents",
    features: [
      "CMA Reports: 5/day",
      "Lead Management: Up to 500 leads",
      "Alerts: Full + engagement tracking",
      "CRM Access: Yes",
      "Reports Download: Full",
      "Team Access: No",
    ],
    cta: "Start Pro",
    highlighted: true,
  },
  {
    key: "premium",
    title: "Premium / Team",
    price: "$99/mo",
    subtitle: "For top producers and teams",
    features: [
      "CMA Reports: 10/day (expandable)",
      "Lead Management: Unlimited",
      "Alerts: Advanced + automation",
      "CRM Access: Full",
      "Reports Download: Unlimited",
      "Team Access: Yes",
    ],
    cta: "Upgrade to Premium",
  },
];

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
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
  const [paywallMsg, setPaywallMsg] = useState("You’ve reached your limit. Upgrade to continue.");
  const [error, setError] = useState<string | null>(null);

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

  const leadsPct = useMemo(() => {
    if (!leadUsage || leadUsage.limit == null || leadUsage.limit <= 0) return 0;
    return Math.min(100, Math.round((leadUsage.count / leadUsage.limit) * 100));
  }, [leadUsage]);

  async function startCheckout(plan: "pro" | "premium") {
    setError(null);
    setLoadingPlan(plan);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const body = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw new Error(body.error || "Failed to start checkout");
      if (!body.url) throw new Error("Missing checkout url");
      window.location.href = body.url;
    } catch (e: any) {
      setError(e?.message ?? "Checkout failed");
      setLoadingPlan(null);
    }
  }

  async function startTrial() {
    setError(null);
    setTrialLoading(true);
    try {
      const res = await fetch("/api/start-trial", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || body?.ok === false) {
        throw new Error(body?.error || "Failed to start trial");
      }
      window.location.href = "/dashboard";
    } catch (e: any) {
      setError(e?.message ?? "Could not start trial");
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
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-sky-50/40 p-6 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.04] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0072ce]">Pricing</p>
        <h1 className="font-heading mt-2 max-w-4xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Grow your real estate business faster with AI tools built for agents
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-700 sm:text-base">
          Generate smarter CMAs, automate lead follow-ups, and close deals with less manual work. From solo agents to
          growing teams, choose the plan that scales your pipeline.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="button"
            size="lg"
            onClick={startTrial}
            disabled={trialLoading || Boolean(planInfo?.trial_used)}
          >
            {trialLoading ? "Starting…" : "🚀 Start Free Trial"}
          </Button>
          <Button href="#plans" variant="outline" size="lg">
            📊 See Plans
          </Button>
        </div>
        <p className="mt-4 text-xs text-slate-600">Trusted by 500+ agents, 10,000+ leads managed</p>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Value props — LeadSmart-style top-accent feature cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
                  You’ve reached your CMA or Lead limit. Upgrade to Premium for unlimited access.
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
              You’ve reached your CMA or Lead limit. Upgrade to Premium for unlimited access.
            </div>
          ) : null}
        </Card>
      </section>

      {/* Pricing table */}
      <section id="plans" className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {plans.map((p) => (
          <Card
            key={p.key}
            className={`p-6 ${
              p.highlighted ? "border-[#0072ce]/35 ring-2 ring-[#0072ce]/15" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {p.title}
              </div>
              {p.highlighted ? (
                <span className="inline-flex items-center rounded-full bg-[#0072ce]/10 px-2 py-1 text-[10px] font-bold text-[#005ca8]">
                  Most Popular
                </span>
              ) : null}
            </div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {p.price}
            </div>
            <div className="mt-1 text-xs text-gray-500">{p.subtitle}</div>
            <ul className="mt-5 space-y-2 text-sm text-gray-700">
              {p.features.map((f, i) => (
                <li key={f} className="flex items-start gap-2">
                  <BrandCheck tone={toneAt(i)} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6">
              {p.key === "free" ? (
                <button
                  type="button"
                  onClick={startTrial}
                  disabled={trialLoading || Boolean(planInfo?.trial_used)}
                  className="w-full rounded-xl bg-slate-100 py-2.5 font-semibold text-slate-800 hover:bg-slate-200 disabled:opacity-60"
                >
                  {trialLoading ? "Starting…" : "Start Free Trial"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startCheckout(p.key as "pro" | "premium")}
                  disabled={loadingPlan === p.key}
                  className="w-full rounded-xl bg-[#0072ce] py-2.5 font-semibold text-white shadow-sm hover:bg-[#005ca8] disabled:opacity-60"
                >
                  {loadingPlan === p.key ? "Redirecting…" : p.cta}
                </button>
              )}
            </div>
            {p.key === "pro" ? (
              <div className="mt-3 text-[11px] text-amber-700 font-medium">
                Hit your 500-lead cap? Upgrade to Premium for unlimited growth.
              </div>
            ) : null}
          </Card>
        ))}
      </section>

      {/* CTA section */}
      <Card className="p-6 sm:p-8">
        <h2 className="font-heading text-2xl font-bold text-slate-900">
          Ready to save hours and close more listings?
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-700">
          Start your 7-day free trial to unlock full access. Agents using PropertyTools AI spend less time on manual
          analysis and more time on revenue-driving conversations.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            type="button"
            size="lg"
            onClick={startTrial}
            disabled={trialLoading || Boolean(planInfo?.trial_used)}
          >
            🚀 Start Free Trial
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => startCheckout("pro")}
            disabled={loadingPlan === "pro"}
          >
            💼 Upgrade Now
          </Button>
        </div>
      </Card>

      {/* Testimonials / social proof */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          "“I generated 3 CMAs before breakfast and won two listing appointments this week.” — Sarah K., Listing Agent",
          "“Lead automation saves me 6–8 hours every week.” — Michael T., Solo Realtor",
          "“Premium removed lead cap anxiety as our team scaled.” — Ariana P., Team Lead",
        ].map((q) => (
          <Card key={q} variant="muted" className="p-4 text-sm text-slate-700">
            {q}
          </Card>
        ))}
      </section>

      <Card variant="muted" className="p-4 text-sm text-slate-700">
        <span className="font-semibold">500+ active agents</span> ·{" "}
        <span className="font-semibold">10,000+ leads managed</span> ·{" "}
        <span className="font-semibold">1,200+ CMA reports generated monthly</span>
      </Card>

      <PaywallModal
        open={paywallOpen || Boolean((leadUsage && leadUsage.limit != null && leadUsage.count >= leadUsage.limit) || cmaUsage?.reached)}
        onClose={() => setPaywallOpen(false)}
        message={paywallMsg}
        ctaLabel="Upgrade Now"
        ctaHref="/pricing"
      />
    </div>
  );
}

