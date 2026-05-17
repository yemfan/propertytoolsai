"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { loginUrl } from "@/lib/loginUrl";
import { mergeAuthHeaders } from "@/lib/mergeAuthHeaders";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  activateSignaturePreviewFromUrl,
  isSignatureTierVisibleClient,
} from "@/lib/billing/signatureFlag";

type PricingT = (key: string, options?: Record<string, unknown>) => string;

// ─── Plan definitions ─────────────────────────────────────────────────────────

type PlanKey = "free" | "pro" | "elite" | "signature" | "team";

/** v2.0 CRM checkout plan key — matches PlanSlug paid tiers. */
type CheckoutPlanKey = "pro" | "premium" | "signature";

/**
 * Plan metadata: only the wire fields (key, checkoutKey, href, highlight,
 * hasBadge, hasTrialNote, periodIsForever) stay in code. User-facing
 * strings (name, price, period, tagline, cta, badge, trialNote) resolve
 * per-render via `t(\`plans.\${key}.field\`)` from the web_pricing
 * namespace.
 *
 * The translation key is "elite" for back-compat with the existing
 * resource files, but the display name renders as "Premium" per the
 * v2.0 rename. Same for "free" → "Starter".
 */
const PLANS: Array<{
  key: PlanKey;
  /** For paid plans: triggers Stripe checkout. For free/team: navigates to href. */
  checkoutKey?: CheckoutPlanKey;
  href?: string;
  highlight?: boolean;
  hasBadge?: boolean;
  hasTrialNote?: boolean;
  /** True for the Starter plan: shows "forever" period without a leading "/". */
  periodIsForever?: boolean;
  /** True for Signature — deep navy + gold visual treatment. */
  signatureLook?: boolean;
}> = [
  { key: "free", href: "/signup", periodIsForever: true },
  {
    key: "pro",
    checkoutKey: "pro",
    highlight: true,
    hasBadge: true,
    hasTrialNote: true,
  },
  { key: "elite", checkoutKey: "premium", hasTrialNote: true },
  {
    key: "signature",
    checkoutKey: "signature",
    hasBadge: true,
    hasTrialNote: true,
    signatureLook: true,
  },
  { key: "team", href: "/contact?from=pricing" },
];

// ─── Feature rows ─────────────────────────────────────────────────────────────

type CellValue = string | boolean | null;

type FeatureRow = {
  /** Translation key under `rows.${key}`. */
  key: string;
  /** When true, look up the tooltip body via `t(\`rows.${key}_tooltip\`)`. */
  hasTooltip?: boolean;
  /**
   * Per-plan cell. Boolean cells render checkmark/dash regardless of locale;
   * string cells resolve via `t(\`rows.${key}_v.${planKey}\`)` and fall back
   * to the inline value for safety if a translation slot is missing.
   */
  values: Record<PlanKey, CellValue>;
};

type FeatureGroup = {
  /** Translation key under `groups.${key}`. */
  key: string;
  rows: FeatureRow[];
};

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    key: "lead_pipeline",
    rows: [
      { key: "leads_per_month", values: { free: "25", pro: "500", elite: "Unlimited", signature: "Unlimited", team: "Unlimited (shared)" } },
      { key: "pipeline_dashboard", values: { free: true, pro: true, elite: true, signature: true, team: true } },
      { key: "stage_tracking", values: { free: "Basic", pro: "Full", elite: "Full", signature: "Full", team: "Full" } },
      { key: "milestones", values: { free: false, pro: true, elite: true, signature: true, team: true } },
      { key: "shared_pool", values: { free: false, pro: false, elite: false, signature: false, team: true } },
    ],
  },
  {
    key: "ai_followup",
    rows: [
      { key: "first_response", hasTooltip: true, values: { free: "Email only", pro: "SMS + Email", elite: "SMS + Email", signature: "SMS + Email", team: "SMS + Email" } },
      { key: "response_time", values: { free: "< 5 min", pro: "< 60 sec", elite: "< 60 sec", signature: "< 60 sec", team: "< 60 sec" } },
      { key: "ai_continuation", values: { free: false, pro: true, elite: true, signature: true, team: true } },
      { key: "bilingual_ai", values: { free: false, pro: true, elite: true, signature: true, team: true } },
      { key: "drip_sequences", values: { free: "1 sequence", pro: "Unlimited", elite: "Unlimited", signature: "Unlimited", team: "Unlimited" } },
      { key: "custom_drip", values: { free: false, pro: false, elite: true, signature: true, team: true } },
      { key: "auto_pause", values: { free: false, pro: true, elite: true, signature: true, team: true } },
      { key: "cultural_calendar", hasTooltip: true, values: { free: false, pro: false, elite: false, signature: true, team: false } },
    ],
  },
  {
    key: "scoring",
    rows: [
      { key: "lead_scoring", values: { free: "Basic", pro: "Advanced", elite: "Predictive AI", signature: "Predictive AI", team: "Predictive AI" } },
      { key: "buyer_intent", values: { free: false, pro: true, elite: true, signature: true, team: true } },
      { key: "hwc_labels", values: { free: false, pro: true, elite: true, signature: true, team: true } },
      { key: "deal_probability", values: { free: false, pro: false, elite: true, signature: true, team: true } },
      { key: "routing_rules", values: { free: false, pro: false, elite: false, signature: false, team: true } },
      { key: "sphere_intelligence_pro", hasTooltip: true, values: { free: false, pro: false, elite: false, signature: true, team: false } },
    ],
  },
  {
    key: "crm",
    rows: [
      { key: "contacts", values: { free: "Up to 50", pro: "Up to 500", elite: "Unlimited", signature: "Unlimited", team: "Unlimited" } },
      { key: "enrichment", values: { free: false, pro: true, elite: true, signature: true, team: true } },
      { key: "crm_integrations", hasTooltip: true, values: { free: false, pro: true, elite: true, signature: true, team: true } },
      { key: "activity_log", values: { free: false, pro: true, elite: true, signature: true, team: true } },
    ],
  },
  {
    key: "reports",
    rows: [
      { key: "cma_reports", values: { free: "2/day", pro: "5/day", elite: "10/day", signature: "Unlimited", team: "Unlimited" } },
      { key: "report_downloads", values: { free: "Limited", pro: "Full", elite: "Full", signature: "Full", team: "Full" } },
      { key: "pipeline_analytics", values: { free: false, pro: "Standard", elite: "Advanced", signature: "Advanced", team: "Advanced" } },
      { key: "team_performance", values: { free: false, pro: false, elite: false, signature: false, team: true } },
    ],
  },
  {
    key: "team_admin",
    rows: [
      { key: "agents_included", values: { free: "1", pro: "1", elite: "1", signature: "1", team: "Up to 5" } },
      { key: "admin_controls", values: { free: false, pro: false, elite: false, signature: false, team: true } },
      { key: "whitelabel", values: { free: false, pro: false, elite: false, signature: false, team: true } },
    ],
  },
  {
    key: "support",
    rows: [
      { key: "support_channel", values: { free: "Email", pro: "Priority email", elite: "Dedicated onboarding", signature: "Concierge — named contact", team: "Priority SLA + CSM" } },
      { key: "onboarding_assist", values: { free: false, pro: false, elite: true, signature: true, team: true } },
      { key: "white_glove_onboarding", hasTooltip: true, values: { free: false, pro: false, elite: false, signature: true, team: false } },
      { key: "custom_voice_tuning", hasTooltip: true, values: { free: false, pro: false, elite: false, signature: true, team: false } },
    ],
  },
];

/**
 * Resolve a cell's display value through the namespace when it's a
 * string. Booleans/nulls pass through so the checkmark / dash renderer
 * picks them up. The inline value acts as `defaultValue` so if a row's
 * translation is missing the page falls back to English instead of
 * showing the raw key.
 */
function resolveCell(rowKey: string, planKey: PlanKey, raw: CellValue, t: PricingT): CellValue {
  if (typeof raw !== "string") return raw;
  return t(`rows.${rowKey}_v.${planKey}`, { defaultValue: raw });
}

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
  const { t } = useTranslation("web_pricing");
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<CheckoutPlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [signatureVisible, setSignatureVisible] = useState(false);
  const autoCheckoutRef = useRef(false);

  /* Signature soft-launch gate */
  useEffect(() => {
    activateSignaturePreviewFromUrl();
    setSignatureVisible(isSignatureTierVisibleClient());
  }, []);

  const visiblePlans = useMemo(
    () => PLANS.filter((p) => p.key !== "signature" || signatureVisible),
    [signatureVisible],
  );

  /* Auth state */
  useEffect(() => {
    const supabase = supabaseBrowser();
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) { setLoggedIn(!!session); setAuthReady(true); }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session); setAuthReady(true);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  /* Auto-trigger checkout after login redirect (e.g. /pricing?checkout_plan=pro) */
  useEffect(() => {
    if (!authReady || !loggedIn) return;
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const plan = sp.get("checkout_plan") as CheckoutPlanKey | null;
    if (!plan || (plan !== "pro" && plan !== "premium" && plan !== "signature")) return;
    if (sp.get("canceled") === "1") return;
    if (autoCheckoutRef.current) return;
    autoCheckoutRef.current = true;
    void startCheckout(plan);
  }, [authReady, loggedIn]);

  /* Auto-trigger trial checkout after login redirect */
  useEffect(() => {
    if (!authReady) return;
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("trial_checkout") !== "1") return;
    if (sp.get("canceled") === "1") return;
    if (!loggedIn) {
      window.location.href = loginUrl({ redirect: "/pricing?trial_checkout=1", reason: "trial" });
      return;
    }
    if (autoCheckoutRef.current) return;
    autoCheckoutRef.current = true;
    void startCheckout("pro", true);
  }, [authReady, loggedIn]);

  async function startCheckout(plan: CheckoutPlanKey, withTrial = true) {
    setError(null);
    setLoadingPlan(plan);
    try {
      const { data: { session } } = await supabaseBrowser().auth.getSession();
      if (!session) {
        setLoadingPlan(null);
        window.location.assign(
          loginUrl({ redirect: `/pricing?checkout_plan=${plan}`, reason: "checkout" })
        );
        return;
      }
      const headers = await mergeAuthHeaders();
      // Route through the v2.0 CRM checkout endpoint so cadence
      // metadata + CA/NY disclosure are wired in. Default to monthly
      // here — annual cadence is selectable on /agent/pricing.
      const res = await fetch("/api/billing/crm-checkout", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ plan, cadence: "monthly", with_trial: withTrial }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || body.ok === false) throw new Error(body?.error || t("errors.open_failed"));
      if (!body.url) throw new Error(t("errors.missing_url"));
      window.location.href = body.url;
    } catch (e: unknown) {
      autoCheckoutRef.current = false;
      setError(e instanceof Error ? e.message : t("errors.default"));
      setLoadingPlan(null);
    }
  }

  function handlePlanClick(plan: typeof PLANS[number]) {
    if (plan.checkoutKey) {
      void startCheckout(plan.checkoutKey);
    }
    // For free/team plans, the Link component handles navigation via href
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <div className="border-b border-slate-200/80 bg-gradient-to-b from-slate-50 to-white px-4 py-14 text-center md:px-6 md:py-16">
        <div className="mx-auto max-w-3xl">
          <div className="mb-3 inline-flex rounded-full border border-blue-200/80 bg-white/90 px-3 py-1 text-xs font-medium text-blue-700">
            {t("header.badge")}
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            {t("header.h1")}
          </h1>
          <p className="mt-3 text-base text-slate-600">
            {t("header.subtitle")}
          </p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-auto max-w-6xl px-4 pt-6 md:px-6">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        </div>
      )}

      {/* Plan cards — 4 or 5 tiers depending on Signature flag. */}
      <div className="px-4 py-12 md:px-6">
        <div
          className={
            signatureVisible
              ? "mx-auto grid max-w-7xl gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
              : "mx-auto grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-4"
          }
        >
          {visiblePlans.map((plan) => {
            const periodKey = plan.periodIsForever ? "period" : "period_short";
            const isSignature = !!plan.signatureLook;
            const cardCls = isSignature
              ? "relative flex flex-col rounded-2xl border-2 border-amber-300 bg-[#0b1e3f] p-6 text-slate-100 shadow-lg"
              : plan.highlight
                ? "relative flex flex-col rounded-2xl border-2 border-[#0072ce] p-6 shadow-lg shadow-[#0072ce]/10"
                : "relative flex flex-col rounded-2xl border border-slate-200 p-6 shadow-sm";
            const badgeCls = isSignature
              ? "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-300 px-3 py-0.5 text-xs font-bold text-amber-950 whitespace-nowrap shadow-sm"
              : "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#0072ce] to-[#4F46E5] px-3 py-0.5 text-xs font-semibold text-white whitespace-nowrap shadow-sm";
            const titleCls = isSignature ? "font-heading text-base font-semibold text-white" : "font-heading text-base font-semibold text-slate-900";
            const priceCls = isSignature ? "text-2xl font-bold text-white" : "text-2xl font-bold text-slate-900";
            const periodTextCls = isSignature ? "text-sm text-slate-300" : "text-sm text-slate-500";
            const tagCls = isSignature ? "mt-2 text-xs text-slate-300" : "mt-2 text-xs text-slate-500";
            return (
            <div
              key={plan.key}
              className={cardCls}
            >
              {plan.hasBadge && (
                <div className={badgeCls}>
                  {t(`plans.${plan.key}.badge`)}
                </div>
              )}
              <div>
                <h2 className={titleCls}>{t(`plans.${plan.key}.name`)}</h2>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className={priceCls}>{t(`plans.${plan.key}.price`)}</span>
                  <span className={periodTextCls}>{t(`plans.${plan.key}.${periodKey}`)}</span>
                </div>
                <p className={tagCls}>{t(`plans.${plan.key}.tagline`)}</p>
              </div>
              <div className="mt-5 flex flex-col gap-2">
                {plan.checkoutKey ? (
                  // MJ-001: anchor instead of button so paid CTAs have a real
                  // href for no-JS users, crawlers, and right-click "open in new
                  // tab". With JS, onClick preventDefault + startCheckout opens
                  // Stripe directly. Without JS, the href navigates to
                  // /pricing?checkout_plan=..., which the auto-checkout effect
                  // picks up after the target page loads.
                  <a
                    href={`/pricing?checkout_plan=${plan.checkoutKey}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handlePlanClick(plan);
                    }}
                    aria-disabled={loadingPlan === plan.checkoutKey}
                    className={`block rounded-xl py-2.5 text-center text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
                      loadingPlan === plan.checkoutKey ? "pointer-events-none opacity-60" : ""
                    } ${
                      isSignature
                        ? "bg-amber-300 text-amber-950 hover:bg-amber-200"
                        : plan.highlight
                          ? "bg-gradient-to-r from-[#0072ce] to-[#4F46E5] text-white shadow-md shadow-[#0072ce]/20 hover:shadow-lg hover:brightness-110"
                          : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    {loadingPlan === plan.checkoutKey ? t("errors.opening_busy") : t(`plans.${plan.key}.cta`)}
                  </a>
                ) : (
                  <Link
                    href={plan.href!}
                    className={
                      isSignature
                        ? "block rounded-xl border border-amber-300 py-2.5 text-center text-sm font-semibold text-amber-200 transition hover:bg-amber-300/10"
                        : "block rounded-xl border border-slate-200 bg-white py-2.5 text-center text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                    }
                  >
                    {t(`plans.${plan.key}.cta`)}
                  </Link>
                )}
                {plan.hasTrialNote && (
                  <p className={isSignature ? "text-center text-[11px] text-slate-400" : "text-center text-[11px] text-slate-400"}>
                    {t(`plans.${plan.key}.trial_note`)}
                  </p>
                )}
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* Feature comparison table */}
      <div className="px-4 pb-20 md:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-8 text-center font-heading text-xl font-semibold text-slate-900">
            {t("table.title")}
          </h2>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-5 py-4 text-left font-semibold text-slate-600 w-1/4">{t("table.column_feature")}</th>
                  {visiblePlans.map((p) => (
                    <th
                      key={p.key}
                      className={`px-3 py-4 text-center font-semibold ${
                        p.signatureLook
                          ? "text-amber-700"
                          : p.highlight
                            ? "text-[#0072ce]"
                            : "text-slate-700"
                      }`}
                    >
                      {t(`plans.${p.key}.name`)}
                      <div className="mt-0.5 text-xs font-normal text-slate-500">
                        {t(`plans.${p.key}.price`)}{p.periodIsForever ? "" : t(`plans.${p.key}.period_short`)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_GROUPS.map((group, gi) => (
                  <>
                    <tr key={`group-${gi}`} className="border-t-2 border-slate-100 bg-slate-50/70">
                      <td colSpan={visiblePlans.length + 1} className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">{t(`groups.${group.key}`)}</td>
                    </tr>
                    {group.rows.map((row, ri) => {
                      const tooltipText = row.hasTooltip ? t(`rows.${row.key}_tooltip`) : null;
                      return (
                      <tr key={`row-${gi}-${ri}`} className={`border-t border-slate-100 transition-colors hover:bg-slate-50/60 ${ri % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}>
                        <td className="px-5 py-3 text-slate-700">
                          <span className="flex items-center gap-1.5">
                            {t(`rows.${row.key}`)}
                            {tooltipText && (
                              <button type="button" onMouseEnter={() => setTooltip(tooltipText)} onMouseLeave={() => setTooltip(null)} className="relative flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500 hover:bg-slate-300">
                                ?
                                {tooltip === tooltipText && (
                                  <span className="absolute bottom-full left-0 z-10 mb-1 w-48 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-xs text-slate-700 shadow-md">{tooltipText}</span>
                                )}
                              </button>
                            )}
                          </span>
                        </td>
                        {visiblePlans.map((p) => (
                          <td
                            key={p.key}
                            className={`px-3 py-3 text-center ${
                              p.signatureLook
                                ? "bg-amber-50/40"
                                : p.highlight
                                  ? "bg-[#0072ce]/[0.03]"
                                  : ""
                            }`}
                          >
                            <Cell value={resolveCell(row.key, p.key, row.values[p.key], t)} />
                          </td>
                        ))}
                      </tr>
                      );
                    })}
                  </>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className="px-5 py-5 text-sm font-medium text-slate-600">{t("table.ready_label")}</td>
                  {visiblePlans.map((p) => (
                    <td key={p.key} className="px-3 py-5 text-center">
                      {p.checkoutKey ? (
                        // See MJ-001 note above — same anchor-with-onClick pattern.
                        <a
                          href={`/pricing?checkout_plan=${p.checkoutKey}`}
                          onClick={(e) => {
                            e.preventDefault();
                            handlePlanClick(p);
                          }}
                          aria-disabled={loadingPlan === p.checkoutKey}
                          className={`inline-block rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200 active:scale-[0.98] ${
                            loadingPlan === p.checkoutKey ? "pointer-events-none opacity-60" : ""
                          } ${
                            p.signatureLook
                              ? "bg-amber-500 text-amber-950 hover:bg-amber-400"
                              : p.highlight
                                ? "bg-[#0072ce] text-white hover:bg-[#005ca8]"
                                : "border border-slate-200 text-slate-700 hover:bg-white"
                          }`}
                        >
                          {loadingPlan === p.checkoutKey ? t("errors.opening_busy_short") : t(`plans.${p.key}.cta`)}
                        </a>
                      ) : (
                        <Link
                          href={p.href!}
                          className={`inline-block rounded-xl px-4 py-2 text-xs font-semibold transition ${
                            p.signatureLook
                              ? "border border-amber-300 text-amber-700 hover:bg-amber-50"
                              : p.highlight
                                ? "bg-[#0072ce] text-white hover:bg-[#005ca8]"
                                : "border border-slate-200 text-slate-700 hover:bg-white"
                          }`}
                        >
                          {t(`plans.${p.key}.cta`)}
                        </Link>
                      )}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-6 text-center">
            <p className="text-sm text-slate-700">
              <strong>{t("footer.questions_label")}</strong>{t("footer.body_prefix")}
              <Link href="/contact" className="font-semibold text-[#0072ce] hover:underline">
                {t("footer.link")}
              </Link>{t("footer.suffix")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
