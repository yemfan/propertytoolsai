"use client";

import Link from "next/link";
import { useState } from "react";

// ─── Plan definitions ─────────────────────────────────────────────────────────

type PlanKey = "free" | "pro" | "elite" | "team";

const PLANS: Array<{
  key: PlanKey;
  name: string;
  price: string;
  period: string;
  tagline: string;
  cta: string;
  ctaHref: string;
  highlight?: boolean;
  badge?: string;
  trialNote?: string;
}> = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    tagline: "Test the platform. See leads flow in.",
    cta: "Get started free",
    ctaHref: "/onboarding",
  },
  {
    key: "pro",
    name: "Pro",
    price: "$49",
    period: "/month",
    tagline: "Full CRM and AI for active agents.",
    cta: "Start free trial",
    ctaHref: "/onboarding",
    highlight: true,
    badge: "Most Popular",
    trialNote: "14-day free trial · No credit card required",
  },
  {
    key: "elite",
    name: "Elite",
    price: "$99",
    period: "/month",
    tagline: "For top producers closing 10+ deals/month.",
    cta: "Start free trial",
    ctaHref: "/onboarding",
    trialNote: "14-day free trial",
  },
  {
    key: "team",
    name: "Team",
    price: "$199",
    period: "/month",
    tagline: "Multiple agents, one shared pipeline.",
    cta: "Contact sales",
    ctaHref: "/contact?from=pricing",
  },
];

// ─── Feature rows ─────────────────────────────────────────────────────────────

type CellValue = string | boolean | null;

type FeatureRow = {
  label: string;
  tooltip?: string;
  values: Record<PlanKey, CellValue>;
};

type FeatureGroup = {
  group: string;
  rows: FeatureRow[];
};

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    group: "Lead Pipeline",
    rows: [
      {
        label: "Leads per month",
        values: { free: "25", pro: "500", elite: "Unlimited", team: "Unlimited (shared)" },
      },
      {
        label: "Lead pipeline dashboard",
        values: { free: true, pro: true, elite: true, team: true },
      },
      {
        label: "Lead stage tracking",
        values: { free: "Basic", pro: "Full", elite: "Full", team: "Full" },
      },
      {
        label: "Tour & offer milestones",
        values: { free: false, pro: true, elite: true, team: true },
      },
      {
        label: "Shared team lead pool",
        values: { free: false, pro: false, elite: false, team: true },
      },
    ],
  },
  {
    group: "AI Follow-Up",
    rows: [
      {
        label: "Automated first response",
        tooltip: "AI replies to new leads within 60 seconds",
        values: { free: "Email only", pro: "SMS + Email", elite: "SMS + Email", team: "SMS + Email" },
      },
      {
        label: "Response time",
        values: { free: "< 5 min", pro: "< 60 sec", elite: "< 60 sec", team: "< 60 sec" },
      },
      {
        label: "AI conversation continuation",
        values: { free: false, pro: true, elite: true, team: true },
      },
      {
        label: "Drip sequences",
        values: { free: "1 sequence", pro: "Unlimited", elite: "Unlimited", team: "Unlimited" },
      },
      {
        label: "Custom drip campaigns",
        values: { free: false, pro: false, elite: true, team: true },
      },
      {
        label: "Auto-pause on reply",
        values: { free: false, pro: true, elite: true, team: true },
      },
    ],
  },
  {
    group: "Lead Scoring & Intelligence",
    rows: [
      {
        label: "Lead scoring",
        values: { free: "Basic", pro: "Advanced", elite: "Predictive AI", team: "Predictive AI" },
      },
      {
        label: "Buyer intent signals",
        values: { free: false, pro: true, elite: true, team: true },
      },
      {
        label: "Hot / warm / cold labels",
        values: { free: false, pro: true, elite: true, team: true },
      },
      {
        label: "Predictive deal probability",
        values: { free: false, pro: false, elite: true, team: true },
      },
      {
        label: "Lead routing rules",
        values: { free: false, pro: false, elite: false, team: true },
      },
    ],
  },
  {
    group: "CRM & Contacts",
    rows: [
      {
        label: "Contacts",
        values: { free: "Up to 50", pro: "Up to 500", elite: "Unlimited", team: "Unlimited" },
      },
      {
        label: "Contact enrichment",
        values: { free: false, pro: true, elite: true, team: true },
      },
      {
        label: "CRM integrations",
        tooltip: "Follow Up Boss, kvCORE, Sierra, Zapier",
        values: { free: false, pro: true, elite: true, team: true },
      },
      {
        label: "Activity log & notes",
        values: { free: false, pro: true, elite: true, team: true },
      },
    ],
  },
  {
    group: "Reports & Analytics",
    rows: [
      {
        label: "CMA reports",
        values: { free: "2/day", pro: "5/day", elite: "10/day", team: "Unlimited" },
      },
      {
        label: "Report downloads",
        values: { free: "Limited", pro: "Full", elite: "Full", team: "Full" },
      },
      {
        label: "Pipeline analytics",
        values: { free: false, pro: "Standard", elite: "Advanced", team: "Advanced" },
      },
      {
        label: "Team performance dashboard",
        values: { free: false, pro: false, elite: false, team: true },
      },
    ],
  },
  {
    group: "Team & Admin",
    rows: [
      {
        label: "Agents included",
        values: { free: "1", pro: "1", elite: "1", team: "Up to 10" },
      },
      {
        label: "Admin controls",
        values: { free: false, pro: false, elite: false, team: true },
      },
      {
        label: "White-label option",
        values: { free: false, pro: false, elite: false, team: true },
      },
    ],
  },
  {
    group: "Support",
    rows: [
      {
        label: "Support channel",
        values: { free: "Email", pro: "Priority email", elite: "Dedicated onboarding", team: "Priority SLA + CSM" },
      },
      {
        label: "Onboarding assistance",
        values: { free: false, pro: false, elite: true, team: true },
      },
    ],
  },
];

// ─── Cell rendering ───────────────────────────────────────────────────────────

function Cell({ value }: { value: CellValue }) {
  if (value === true) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#0072ce]/10">
        <svg className="h-3.5 w-3.5 text-[#0072ce]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  if (value === false || value === null) {
    return <span className="text-slate-300">—</span>;
  }
  return <span className="text-sm text-slate-700">{value}</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ConsumerPricingClientPage() {
  const [tooltip, setTooltip] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <div className="border-b border-slate-200/80 bg-gradient-to-b from-slate-50 to-white px-4 py-14 text-center md:px-6 md:py-16">
        <div className="mx-auto max-w-3xl">
          <div className="mb-3 inline-flex rounded-full border border-blue-200/80 bg-white/90 px-3 py-1 text-xs font-medium text-blue-700">
            No contracts · Cancel anytime
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-3 text-base text-slate-600">
            Every plan includes a 14-day free trial on paid tiers. Start free, upgrade when you&apos;re ready.
          </p>
        </div>
      </div>

      {/* Plan cards */}
      <div className="px-4 py-12 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                plan.highlight
                  ? "border-2 border-[#0072ce] shadow-lg shadow-[#0072ce]/10"
                  : "border-slate-200 shadow-sm"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#0072ce] px-3 py-0.5 text-xs font-semibold text-white whitespace-nowrap">
                  {plan.badge}
                </div>
              )}
              <div>
                <h2 className="font-heading text-base font-semibold text-slate-900">{plan.name}</h2>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-slate-900">{plan.price}</span>
                  <span className="text-sm text-slate-500">{plan.period}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{plan.tagline}</p>
              </div>
              <div className="mt-5 flex flex-col gap-2">
                <Link
                  href={plan.ctaHref}
                  className={`block rounded-xl py-2.5 text-center text-sm font-semibold transition ${
                    plan.highlight
                      ? "bg-[#0072ce] text-white hover:bg-[#005ca8]"
                      : plan.key === "team"
                        ? "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                        : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {plan.cta}
                </Link>
                {plan.trialNote && (
                  <p className="text-center text-[11px] text-slate-400">{plan.trialNote}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature comparison table */}
      <div className="px-4 pb-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-8 text-center font-heading text-xl font-semibold text-slate-900">
            Full Feature Comparison
          </h2>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              {/* Column headers */}
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-5 py-4 text-left font-semibold text-slate-600 w-1/3">Feature</th>
                  {PLANS.map((p) => (
                    <th
                      key={p.key}
                      className={`px-4 py-4 text-center font-semibold ${
                        p.highlight ? "text-[#0072ce]" : "text-slate-700"
                      }`}
                    >
                      {p.name}
                      <div className="mt-0.5 text-xs font-normal text-slate-500">
                        {p.price}{p.period === "forever" ? "" : p.period}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {FEATURE_GROUPS.map((group, gi) => (
                  <>
                    {/* Group header row */}
                    <tr key={`group-${gi}`} className="border-t-2 border-slate-100 bg-slate-50/70">
                      <td
                        colSpan={5}
                        className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500"
                      >
                        {group.group}
                      </td>
                    </tr>

                    {/* Feature rows */}
                    {group.rows.map((row, ri) => (
                      <tr
                        key={`row-${gi}-${ri}`}
                        className={`border-t border-slate-100 transition-colors hover:bg-slate-50/60 ${
                          ri % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                        }`}
                      >
                        <td className="px-5 py-3 text-slate-700">
                          <span className="flex items-center gap-1.5">
                            {row.label}
                            {row.tooltip && (
                              <button
                                type="button"
                                onMouseEnter={() => setTooltip(row.tooltip!)}
                                onMouseLeave={() => setTooltip(null)}
                                className="relative flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500 hover:bg-slate-300"
                              >
                                ?
                                {tooltip === row.tooltip && (
                                  <span className="absolute bottom-full left-0 z-10 mb-1 w-48 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-xs text-slate-700 shadow-md">
                                    {row.tooltip}
                                  </span>
                                )}
                              </button>
                            )}
                          </span>
                        </td>
                        {PLANS.map((p) => (
                          <td
                            key={p.key}
                            className={`px-4 py-3 text-center ${
                              p.highlight ? "bg-[#0072ce]/[0.03]" : ""
                            }`}
                          >
                            <Cell value={row.values[p.key]} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>

              {/* CTA footer row */}
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className="px-5 py-5 text-sm font-medium text-slate-600">Ready to start?</td>
                  {PLANS.map((p) => (
                    <td key={p.key} className="px-4 py-5 text-center">
                      <Link
                        href={p.ctaHref}
                        className={`inline-block rounded-xl px-4 py-2 text-xs font-semibold transition ${
                          p.highlight
                            ? "bg-[#0072ce] text-white hover:bg-[#005ca8]"
                            : "border border-slate-200 text-slate-700 hover:bg-white"
                        }`}
                      >
                        {p.cta}
                      </Link>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* FAQ callout */}
          <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-6 text-center">
            <p className="text-sm text-slate-700">
              <strong>Questions?</strong> Every paid plan starts with a 14-day free trial. Cancel anytime before your trial ends — no charge.
              Need a custom plan for a large brokerage?{" "}
              <Link href="/contact" className="font-semibold text-[#0072ce] hover:underline">
                Talk to us
              </Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
