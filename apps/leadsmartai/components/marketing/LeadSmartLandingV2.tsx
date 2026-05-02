"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  CalendarCheck,
  ChartBar,
  CheckCircle2,
  Clock,
  Filter,
  Globe2,
  HandHeart,
  LineChart,
  MessagesSquare,
  Settings2,
  Sparkles,
  TrendingUp,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { LeadSmartLogo } from "@/components/brand/LeadSmartLogo";
import { Button } from "@/components/ui/button";
import { BrandCheck } from "@/components/brand/BrandCheck";
import HeaderAuthActions from "@/components/HeaderAuthActions";

const ExitIntentPopup = dynamic(
  () => import("@/components/marketing/ExitIntentPopup"),
  { ssr: false },
);
const SupportChatLauncher = dynamic(
  () =>
    import("@/components/support/CustomerSupportChat").then((mod) => ({
      default: mod.SupportChatLauncher,
    })),
  { ssr: false },
);

/**
 * V2 conversion-focused landing.
 *
 * Replaces the long-form V1 narrative with a tighter funnel:
 *   Hero (problem-aware) → How It Works (visual flow) → Growth
 *   Engine (5 product pillars) → Sales Style Engine (the
 *   differentiator) → Results → Why us (comparison table) → ROI
 *   nudge → Final CTA. The footer comes from the global
 *   `AppShell` `<Footer />`, so this file ends at the final CTA.
 *
 * Section anchors are paired with the in-page nav so the hash links
 * jump smoothly. `/features` and `/pricing` are full routes — the
 * dedicated pages carry the depth that doesn't fit on the landing.
 */

const PRIMARY_CTA_HREF = "/onboarding";

const NAV_SECTIONS: { label: string; href: string }[] = [
  { label: "How It Works", href: "#how" },
  { label: "Features", href: "/features" },
  { label: "Results", href: "#results" },
  { label: "Why Us", href: "#why" },
  { label: "Pricing", href: "/pricing" },
];

/**
 * IntersectionObserver-backed scroll reveal — keeps the page from
 * feeling static without a runtime animation library. Runs once
 * per element.
 */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
            return;
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, visible };
}

function RevealSection({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

export default function LeadSmartLandingV2() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

  // Mobile drawer focus + escape handling — same pattern as V1 so
  // the keyboard / screen-reader behavior stays familiar.
  useEffect(() => {
    if (!mobileNavOpen) return;
    drawerCloseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      hamburgerRef.current?.focus();
    };
  }, [mobileNavOpen]);

  return (
    <>
      <main
        id="main-content"
        className="bg-white text-gray-900 dark:bg-slate-950 dark:text-slate-100"
      >
        {/* ── NAV ─── */}
        <header className="sticky top-0 z-50 border-b border-gray-200/60 bg-white/85 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/80">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link
              href="/"
              className="flex min-w-0 items-center rounded-md transition hover:opacity-90"
            >
              <LeadSmartLogo className="h-8 w-auto max-w-[180px] sm:h-9 sm:max-w-[280px] lg:max-w-[320px]" />
            </Link>
            <nav
              className="hidden items-center gap-x-5 text-sm md:flex lg:gap-x-7"
              aria-label="Page sections"
            >
              {NAV_SECTIONS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="font-medium !text-gray-700 transition-colors hover:!text-[#0072ce] dark:!text-slate-300 dark:hover:!text-[#4da3e8]"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <Button
                size="sm"
                href={PRIMARY_CTA_HREF}
                className="hidden whitespace-nowrap sm:inline-flex"
              >
                Activate AI Engine
              </Button>
              <div className="hidden items-center gap-2 sm:gap-3 md:flex">
                <HeaderAuthActions />
                <SupportChatLauncher buttonClassName="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200/90 bg-white text-gray-600 shadow-sm transition hover:border-[#0072ce]/40 hover:bg-gray-50 hover:text-[#0072ce] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0072ce]/40 sm:h-10 sm:w-10 sm:rounded-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-[#4da3e8]" />
              </div>
              <button
                ref={hamburgerRef}
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open menu"
                aria-expanded={mobileNavOpen}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200/90 bg-white text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 md:hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* ── Mobile drawer ─── */}
        {mobileNavOpen ? (
          <div
            className="fixed inset-0 z-[60] md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
          >
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close menu"
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />
            <div
              className="absolute right-0 top-0 bottom-0 flex w-[86%] max-w-[340px] flex-col overflow-y-auto border-l border-slate-200/80 bg-white shadow-[-8px_0_48px_-12px_rgba(15,23,42,0.25)] dark:border-slate-800 dark:bg-slate-950"
              style={{
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
                minHeight: "100dvh",
              }}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Menu
                </span>
                <button
                  ref={drawerCloseRef}
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close menu"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <nav className="flex flex-col px-3 py-3" aria-label="Mobile sections">
                {NAV_SECTIONS.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className="rounded-xl px-3 py-3 text-base font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
                <Button
                  href={PRIMARY_CTA_HREF}
                  className="w-full justify-center"
                  onClick={() => setMobileNavOpen(false)}
                >
                  Activate AI Engine
                </Button>
                <div
                  className="flex items-center justify-center gap-2"
                  onClick={() => setMobileNavOpen(false)}
                >
                  <HeaderAuthActions />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── HERO ─── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
          <div
            className="pointer-events-none absolute inset-0 -z-0"
            aria-hidden
          >
            <div
              className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-[0.15] blur-[100px] dark:opacity-[0.08]"
              style={{
                background:
                  "conic-gradient(from 180deg at 50% 50%, #0072ce 0deg, #4F46E5 120deg, #0072ce 240deg, #7c3aed 360deg)",
              }}
            />
          </div>
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 py-20 md:grid-cols-2 md:gap-12 md:py-28">
            <div className="max-w-xl lg:max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#0072ce]/20 bg-white/80 px-4 py-1.5 text-xs font-medium text-[#0072ce] shadow-sm backdrop-blur-sm dark:border-[#0072ce]/30 dark:bg-slate-900/80 dark:text-[#4da3e8]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0072ce] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0072ce]" />
                </span>
                The AI deal engine for real estate agents
              </div>
              <h1 className="font-heading text-4xl font-extrabold leading-[1.08] tracking-tight text-gray-950 md:text-5xl lg:text-[3.25rem] dark:text-white">
                Turn Online Traffic into{" "}
                <span className="bg-gradient-to-r from-[#0072ce] via-[#4F46E5] to-[#7c3aed] bg-clip-text text-transparent">
                  Closed Deals
                </span>{" "}
                — Automatically
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-gray-600 md:text-xl dark:text-slate-400">
                Capture, qualify, follow up, and convert leads 24/7 with your
                AI-powered growth engine — built specifically for real estate
                agents.
              </p>

              <ul className="mt-7 space-y-2.5 text-base text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-0.5 text-lg">⚡</span>
                  <span>Respond to every lead in under 60 seconds</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-0.5 text-lg">🎯</span>
                  <span>Focus only on high-intent buyers &amp; sellers</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-0.5 text-lg">🔁</span>
                  <span>Never lose a deal due to missed follow-up</span>
                </li>
              </ul>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  href={PRIMARY_CTA_HREF}
                  className="min-h-[48px] px-7 text-base shadow-lg shadow-[#0072ce]/20 hover:shadow-xl hover:shadow-[#0072ce]/30"
                >
                  Get Your AI Deal Engine Started
                </Button>
                <Button
                  variant="outline"
                  href="#how"
                  className="min-h-11 px-6 text-base"
                >
                  See How It Works
                </Button>
              </div>

              <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
                No setup required · 14-day trial on paid plans · Cancel anytime
              </p>
            </div>

            {/* Dashboard preview mockup */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-2xl shadow-slate-900/[0.1] dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center gap-2 rounded-t-xl border-b border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <span className="ml-2 text-[10px] font-medium text-slate-400">
                  LeadSmart AI — Live
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
                    Auto-replying
                  </span>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <div className="grid grid-cols-3 gap-2">
                  <DashStat n="12" l="New leads" tone="blue" />
                  <DashStat n="94%" l="Reply rate" tone="green" />
                  <DashStat n="8" l="Tours booked" tone="violet" />
                </div>
                <div className="space-y-1.5">
                  {[
                    { name: "Sarah M.", status: "Hot", emoji: "🔥", time: "2m ago" },
                    { name: "James W.", status: "Warm", emoji: "💬", time: "15m ago" },
                    { name: "Lisa K.", status: "New", emoji: "✨", time: "1h ago" },
                  ].map((lead) => (
                    <div
                      key={lead.name}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-700/30"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{lead.emoji}</span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {lead.name}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                            lead.status === "Hot"
                              ? "bg-orange-100 text-orange-700"
                              : lead.status === "Warm"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {lead.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">{lead.time}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center justify-between text-[10px] font-medium text-slate-400">
                    <span>Pipeline health</span>
                    <span>72%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-[#0072ce] to-[#4F46E5]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ─── */}
        <section
          id="how"
          className="border-y border-slate-200/80 bg-slate-50/70 px-6 py-20 dark:border-slate-800 dark:bg-slate-900/30 md:py-24"
        >
          <div className="mx-auto max-w-6xl">
            <RevealSection className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0072ce]">
                The deal flow
              </p>
              <h2 className="mt-2 font-heading text-3xl font-bold text-slate-900 md:text-4xl dark:text-white">
                From Lead to Closing —{" "}
                <span className="bg-gradient-to-r from-[#0072ce] to-[#4F46E5] bg-clip-text text-transparent">
                  handled by AI
                </span>
              </h2>
              <p className="mt-4 text-base text-slate-600 dark:text-slate-400 md:text-lg">
                LeadSmart AI turns your website visitors and inbound traffic into
                qualified conversations — and keeps nurturing them until they&apos;re
                ready to close.
              </p>
            </RevealSection>

            <RevealSection delay={120} className="mt-12">
              <FlowDiagram
                steps={[
                  { label: "Traffic", icon: Globe2, tone: "slate" },
                  { label: "AI Capture", icon: Filter, tone: "blue" },
                  { label: "AI Qualify", icon: Sparkles, tone: "violet" },
                  { label: "AI Follow-up", icon: MessagesSquare, tone: "amber" },
                  { label: "Agent", icon: HandHeart, tone: "emerald" },
                  { label: "Deal Closed", icon: CheckCircle2, tone: "green" },
                ]}
              />
            </RevealSection>
          </div>
        </section>

        {/* ── GROWTH ENGINE (5 pillars) ─── */}
        <section className="px-6 py-20 md:py-24">
          <div className="mx-auto max-w-7xl">
            <RevealSection className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0072ce]">
                Your AI growth engine
              </p>
              <h2 className="mt-2 font-heading text-3xl font-bold text-slate-900 md:text-4xl dark:text-white">
                Five systems that close more deals — without more hours
              </h2>
            </RevealSection>

            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {GROWTH_ENGINE.map((p, i) => (
                <RevealSection key={p.title} delay={i * 80}>
                  <div className="group relative flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-6 transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    <div className="mb-4 flex items-center justify-between">
                      <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${p.chip.bg} ${p.chip.text}`}>
                        <p.icon size={22} strokeWidth={2} aria-hidden />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Step {p.step}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span aria-hidden className="text-xl">
                        {p.emoji}
                      </span>
                      <h3 className="font-heading text-base font-bold text-slate-900 dark:text-white">
                        {p.title}
                      </h3>
                    </div>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      {p.tagline}
                    </p>
                    <ul className="mt-5 space-y-2">
                      {p.bullets.map((b) => (
                        <li
                          key={b}
                          className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300"
                        >
                          <BrandCheck tone={p.checkTone} />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>

        {/* ── SALES STYLE ENGINE ─── */}
        <section className="border-y border-slate-200/80 bg-gradient-to-b from-white via-blue-50/30 to-white px-6 py-20 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 md:py-24">
          <div className="mx-auto max-w-6xl">
            <RevealSection className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0072ce]">
                The differentiator
              </p>
              <h2 className="mt-2 font-heading text-3xl font-bold text-slate-900 md:text-4xl dark:text-white">
                Choose how your AI sells for you
              </h2>
              <p className="mt-4 text-base text-slate-600 dark:text-slate-400 md:text-lg">
                Every agent has a different style — now your AI can match it.
              </p>
            </RevealSection>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {SALES_STYLES.map((s, i) => (
                <RevealSection key={s.name} delay={i * 100}>
                  <div className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${s.chip.bg} ${s.chip.text} text-2xl`}>
                      {s.emoji}
                    </div>
                    <h3 className="mt-4 font-heading text-lg font-bold text-slate-900 dark:text-white">
                      {s.name}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      {s.body}
                    </p>
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Best for: <span className="text-slate-700 dark:text-slate-200">{s.bestFor}</span>
                    </p>
                  </div>
                </RevealSection>
              ))}
            </div>

            <RevealSection delay={400} className="mt-10 text-center">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Adapt your AI to your personality — and your market.
              </p>
            </RevealSection>
          </div>
        </section>

        {/* ── RESULTS ─── */}
        <section
          id="results"
          className="px-6 py-20 md:py-24"
        >
          <div className="mx-auto max-w-6xl">
            <RevealSection className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0072ce]">
                Designed to increase your closings
              </p>
              <h2 className="mt-2 font-heading text-3xl font-bold text-slate-900 md:text-4xl dark:text-white">
                Speed + consistency ={" "}
                <span className="bg-gradient-to-r from-[#0072ce] to-[#4F46E5] bg-clip-text text-transparent">
                  more deals
                </span>
              </h2>
            </RevealSection>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {RESULTS.map((r, i) => (
                <RevealSection key={r.label} delay={i * 100}>
                  <div className="flex h-full flex-col rounded-2xl border-2 border-slate-200/80 bg-white p-7 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
                    <span aria-hidden className="text-3xl">
                      {r.emoji}
                    </span>
                    <p className="mt-3 font-heading text-4xl font-extrabold text-[#0072ce] md:text-5xl">
                      {r.value}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {r.label}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {r.body}
                    </p>
                  </div>
                </RevealSection>
              ))}
            </div>

            <RevealSection delay={400} className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
              <p>
                Estimates based on internal pilots. Your numbers will move when
                speed-to-lead drops below 60 seconds and follow-up cadence runs
                automatically.
              </p>
            </RevealSection>
          </div>
        </section>

        {/* ── WHY US (comparison table) ─── */}
        <section
          id="why"
          className="border-y border-slate-200/80 bg-slate-50/70 px-6 py-20 dark:border-slate-800 dark:bg-slate-900/30 md:py-24"
        >
          <div className="mx-auto max-w-5xl">
            <RevealSection className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0072ce]">
                Why LeadSmart AI
              </p>
              <h2 className="mt-2 font-heading text-3xl font-bold text-slate-900 md:text-4xl dark:text-white">
                Not just another CRM —{" "}
                <span className="bg-gradient-to-r from-[#0072ce] to-[#4F46E5] bg-clip-text text-transparent">
                  a complete AI closing system
                </span>
              </h2>
            </RevealSection>

            <RevealSection delay={120} className="mt-10">
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Traditional Tools
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#0072ce] dark:text-[#4da3e8]">
                        LeadSmart AI
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {COMPARISON.map((row) => (
                      <tr key={row.left}>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                          <span className="mr-2 text-slate-400">✕</span>
                          {row.left}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">
                          <span className="mr-2 text-emerald-600">✓</span>
                          {row.right}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </RevealSection>
          </div>
        </section>

        {/* ── ROI ─── */}
        <section className="bg-gradient-to-b from-rose-50/80 via-white to-white px-6 py-20 dark:from-rose-950/15 dark:via-slate-950 dark:to-slate-950 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <RevealSection>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-400">
                The cost of doing nothing
              </p>
              <h2 className="mt-2 font-heading text-3xl font-bold leading-tight text-slate-900 md:text-4xl dark:text-white">
                How many deals are you{" "}
                <span className="text-rose-700 dark:text-rose-400">missing right now</span>?
              </h2>
              <p className="mt-5 text-base text-slate-700 dark:text-slate-300 md:text-lg">
                If you miss follow-ups, respond late, or forget to nurture leads —
                you&apos;re losing deals every month.
              </p>
            </RevealSection>

            <RevealSection delay={120}>
              <ul className="mx-auto mt-8 max-w-md space-y-3 text-left text-base text-slate-700 dark:text-slate-300">
                {[
                  "Hot leads going to the agent who responded first",
                  "Follow-up sequences breaking after the second message",
                  "Sphere contacts crossing equity thresholds without a nudge",
                ].map((text) => (
                  <li
                    key={text}
                    className="flex items-start gap-3 border-l-4 border-rose-200 pl-4 dark:border-rose-800"
                  >
                    <span className="font-semibold text-rose-600 dark:text-rose-400">
                      →
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </RevealSection>

            <RevealSection delay={220}>
              <p className="mt-8 font-heading text-lg font-bold text-slate-900 md:text-xl dark:text-white">
                LeadSmart AI fixes that — automatically.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Button href={PRIMARY_CTA_HREF} className="min-h-11 px-6 text-base">
                  Start Closing More Deals Today
                </Button>
                <Button
                  variant="outline"
                  href="/agent/pricing"
                  className="min-h-11 px-6 text-base"
                >
                  Estimate Your ROI
                </Button>
              </div>
            </RevealSection>
          </div>
        </section>

        {/* ── FINAL CTA ─── */}
        <section className="px-6 py-20 md:py-24">
          <div className="mx-auto max-w-4xl rounded-3xl bg-gradient-to-br from-[#0072ce] via-[#4F46E5] to-[#7c3aed] px-8 py-14 text-center text-white shadow-2xl md:px-12">
            <RevealSection>
              <h2 className="font-heading text-3xl font-bold leading-tight md:text-4xl">
                Your next deal is already visiting your website.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-white/90 md:text-lg">
                Don&apos;t let it slip away.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href={PRIMARY_CTA_HREF}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#0072ce] shadow-lg transition hover:bg-slate-50 md:text-base"
                >
                  Activate Your AI Deal Engine
                  <ArrowRight size={18} aria-hidden />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20 md:text-base"
                >
                  Book a Demo
                </Link>
              </div>
              <p className="mt-6 text-xs text-white/70">
                14-day trial on paid plans · No credit card required to start
              </p>
            </RevealSection>
          </div>
        </section>

        {/* Footer is provided by AppShell — see components/AppShell.tsx
            (`<Footer />` rendered for every public page including the
            marketing-home branch). */}
      </main>

      <ExitIntentPopup role="agent" />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Sub-components + content tables
 * ──────────────────────────────────────────────────────────────────── */

function DashStat({ n, l, tone }: { n: string; l: string; tone: "blue" | "green" | "violet" }) {
  const palette = {
    blue: { color: "text-[#0072ce]", bg: "bg-[#0072ce]/5" },
    green: { color: "text-emerald-600", bg: "bg-emerald-50" },
    violet: { color: "text-[#4F46E5]", bg: "bg-[#4F46E5]/5" },
  }[tone];
  return (
    <div className={`rounded-xl ${palette.bg} p-3 text-center dark:bg-slate-700/50`}>
      <p className={`text-2xl font-extrabold ${palette.color}`}>{n}</p>
      <p className="text-[10px] font-medium text-gray-500 dark:text-slate-400">{l}</p>
    </div>
  );
}

type FlowTone = "slate" | "blue" | "violet" | "amber" | "emerald" | "green";

const FLOW_TONE: Record<FlowTone, { bg: string; text: string; border: string }> = {
  slate: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", border: "border-slate-200 dark:border-slate-700" },
  blue: { bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-[#0072ce] dark:text-[#4da3e8]", border: "border-blue-200 dark:border-blue-800" },
  violet: { bg: "bg-violet-50 dark:bg-violet-900/30", text: "text-violet-600 dark:text-violet-300", border: "border-violet-200 dark:border-violet-800" },
  amber: { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
  green: { bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-700 dark:text-green-300", border: "border-green-300 dark:border-green-700" },
};

/**
 * Visual workflow flow: 6 nodes connected by arrows. Wraps to two
 * rows on narrow viewports (3+3). Each node is a vertical stack of
 * icon + label so it stays readable at small sizes.
 */
function FlowDiagram({
  steps,
}: {
  steps: { label: string; icon: LucideIcon; tone: FlowTone }[];
}) {
  return (
    <div className="grid grid-cols-3 gap-3 md:grid-cols-6 md:gap-2">
      {steps.map((s, i) => {
        const palette = FLOW_TONE[s.tone];
        return (
          <div key={s.label} className="relative flex flex-col items-center text-center">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-2xl border-2 ${palette.border} ${palette.bg} ${palette.text}`}
            >
              <s.icon size={26} strokeWidth={2} aria-hidden />
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-700 dark:text-slate-200">
              {s.label}
            </p>
            {/* Arrow to the next node — desktop only (the wrapping
                grid handles mobile flow direction). */}
            {i < steps.length - 1 ? (
              <span
                aria-hidden
                className="pointer-events-none absolute right-[-12px] top-7 hidden text-slate-300 md:block dark:text-slate-600"
              >
                <ArrowRight size={18} strokeWidth={2.25} />
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

type GrowthPillar = {
  step: string;
  emoji: string;
  title: string;
  tagline: string;
  bullets: string[];
  icon: LucideIcon;
  chip: { bg: string; text: string };
  checkTone: "primary" | "primaryDark" | "success" | "accent";
};

const GROWTH_ENGINE: GrowthPillar[] = [
  {
    step: "1",
    emoji: "🧲",
    title: "Capture Every Lead",
    tagline:
      "Turn anonymous traffic into real opportunities — smart landing pages, home value tools, lead capture forms, and CRM integrations.",
    bullets: [
      "Smart landing pages",
      "Home value tools",
      "Lead capture forms",
      "Native CRM integrations",
    ],
    icon: Filter,
    chip: { bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-[#0072ce] dark:text-[#4da3e8]" },
    checkTone: "primary",
  },
  {
    step: "2",
    emoji: "⚡",
    title: "Qualify Instantly",
    tagline:
      "Know who's serious without lifting a finger — AI lead scoring, intent detection, and smart enrichment do the work.",
    bullets: [
      "AI lead scoring",
      "Buyer & seller intent detection",
      "Smart data enrichment",
    ],
    icon: Sparkles,
    chip: { bg: "bg-violet-50 dark:bg-violet-900/30", text: "text-violet-600 dark:text-violet-300" },
    checkTone: "primaryDark",
  },
  {
    step: "3",
    emoji: "🤖",
    title: "Follow Up Automatically",
    tagline:
      "Engage every lead at the perfect moment — SMS + email automation, instant responses, and behavior-based triggers.",
    bullets: [
      "SMS + email automation",
      "Instant responses (within seconds)",
      "Behavior-based triggers",
    ],
    icon: Bot,
    chip: { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-300" },
    checkTone: "accent",
  },
  {
    step: "4",
    emoji: "💬",
    title: "Convert More Conversations",
    tagline:
      "Turn engagement into real appointments — AI conversation engine, smart reply suggestions, and one-click booking.",
    bullets: [
      "AI conversation engine",
      "Smart reply suggestions",
      "Appointment booking automation",
    ],
    icon: MessagesSquare,
    chip: { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-300" },
    checkTone: "success",
  },
  {
    step: "5",
    emoji: "📈",
    title: "Scale Without Limits",
    tagline:
      "Grow your business without growing your workload — performance analytics, AI optimization, and automated workflows.",
    bullets: [
      "Performance analytics",
      "AI optimization engine",
      "Automated workflows",
    ],
    icon: LineChart,
    chip: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
    checkTone: "primaryDark",
  },
];

const SALES_STYLES: Array<{
  emoji: string;
  name: string;
  body: string;
  bestFor: string;
  chip: { bg: string; text: string };
}> = [
  {
    emoji: "🤝",
    name: "Consultative Advisor",
    body: "Builds trust, educates, and nurtures over time. Long-game tone for buyers who need to feel guided through the process.",
    bestFor: "Sphere referrals · long sales cycles",
    chip: { bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-[#0072ce] dark:text-[#4da3e8]" },
  },
  {
    emoji: "⚡",
    name: "Closer Mode",
    body: "Drives urgency and fast decisions. Direct, action-oriented, designed to convert hot leads before they shop another agent.",
    bestFor: "PPC / portal leads · multiple-offer markets",
    chip: { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-300" },
  },
  {
    emoji: "💬",
    name: "Friendly Connector",
    body: "Relationship-first. Casual, warm, and personable — the tone that makes first-time buyers actually reply.",
    bestFor: "First-time buyers · social-media leads",
    chip: { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-300" },
  },
];

const RESULTS: Array<{ emoji: string; value: string; label: string; body: string }> = [
  {
    emoji: "📈",
    value: "2×",
    label: "More appointments booked",
    body: "When AI fires the first reply in under 60 seconds, more leads show up to a tour or consultation.",
  },
  {
    emoji: "⚡",
    value: "90%",
    label: "Faster lead response",
    body: "Median first-reply time drops from minutes (or hours) to seconds — the difference between you and the next agent.",
  },
  {
    emoji: "💰",
    value: "↑",
    label: "Higher conversion rates",
    body: "Behavior-based follow-up keeps warm leads engaged through the silent middle of the funnel.",
  },
];

const COMPARISON: Array<{ left: string; right: string }> = [
  { left: "Manual follow-up", right: "Instant AI engagement, 24/7" },
  { left: "Generic CRM", right: "Real-estate-native AI" },
  { left: "Missed leads after hours", right: "AI replies the moment they hit submit" },
  { left: "Disconnected tools", right: "One full growth engine" },
  { left: "No coaching layer", right: "Producer Track + Top Producer Track included" },
];

// Suppress unused-import lint when icons are referenced inline above.
// (TypeScript doesn't flag, but keep these so future edits don't
// accidentally remove the imports.)
void Zap;
void TrendingUp;
void Workflow;
void ChartBar;
void CalendarCheck;
void Settings2;
void Clock;
