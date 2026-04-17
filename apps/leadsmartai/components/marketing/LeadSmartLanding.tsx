"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  BarChart3,
  Brain,
  Repeat2,
  Zap,
} from "lucide-react";
import { LeadSmartLogo } from "@/components/brand/LeadSmartLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FeatureHighlightCard } from "@/components/ui/FeatureHighlightCard";
import { BrandCheck } from "@/components/brand/BrandCheck";
import HeaderAuthActions from "@/components/HeaderAuthActions";
import VslSection from "@/components/VslSection";

const ExitIntentPopup = dynamic(
  () => import("@/components/marketing/ExitIntentPopup"),
  { ssr: false }
);

const SupportChatLauncher = dynamic(
  () => import("@/components/support/CustomerSupportChat").then(mod => ({ default: mod.SupportChatLauncher })),
  { ssr: false }
);

const primaryCtaHref = "/onboarding";
const vslAnchorHref = "#vsl";

/**
 * Section anchor links shared between the desktop nav (md+) and the
 * mobile drawer. Hash slugs are computed once here so they stay in sync
 * if section IDs ever move.
 */
const NAV_SECTIONS: { label: string; hash: string }[] = [
  { label: "Problem", hash: "#problem" },
  { label: "Solution", hash: "#solution" },
  { label: "How It Works", hash: "#how" },
  { label: "Features", hash: "#features" },
  { label: "Pricing", hash: "#pricing" },
];

/* ── Scroll-triggered fade-in ── */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); io.disconnect(); } },
      { threshold: 0.12 }
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
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function getVslConfig(): {
  videoType: "youtube" | "vimeo" | "html5";
  videoIdOrUrl: string;
} {
  const mp4 = process.env.NEXT_PUBLIC_VSL_MP4_URL?.trim();
  if (mp4) return { videoType: "html5", videoIdOrUrl: mp4 };
  const vimeo = process.env.NEXT_PUBLIC_VSL_VIMEO_ID?.trim();
  if (vimeo) return { videoType: "vimeo", videoIdOrUrl: vimeo };
  return {
    videoType: "youtube",
    videoIdOrUrl: process.env.NEXT_PUBLIC_VSL_YOUTUBE_ID?.trim() ?? "",
  };
}

export default function LeadSmartLanding() {
  const vslConfig = getVslConfig();
  const hasVsl = Boolean(vslConfig.videoIdOrUrl);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  /**
   * Pricing billing-cycle toggle. Annual billing gives users two
   * months free (monthly * 10 = annual equivalent), which renders as
   * a ~17% savings badge above the toggle. Persisted only in local
   * component state — downstream checkout URLs accept the same plan
   * slug regardless of cycle, so no routing changes are required.
   */
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  /**
   * Body scroll lock while the mobile nav drawer is open. Uses
   * `position: fixed` (not just `overflow: hidden`) because iOS Safari
   * ignores `overflow: hidden` on <body> for touch scrolling — the
   * background page would still scroll under the open drawer otherwise.
   * We restore the previous scroll position on close so the user lands
   * back where they were.
   */
  useEffect(() => {
    if (!mobileNavOpen) return;
    const scrollY = window.scrollY;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;
      window.scrollTo(0, scrollY);
    };
  }, [mobileNavOpen]);

  /**
   * Refs for focus management. When the drawer opens, focus moves
   * to the close button. When it closes, focus returns to the
   * hamburger. WCAG 2.4.3 requires modal focus to stay inside.
   */
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const drawerPanelRef = useRef<HTMLDivElement>(null);

  /**
   * Focus trap + Escape handler for the mobile drawer.
   *
   * When the drawer opens:
   * 1. Move focus to the close button (`drawerCloseRef`)
   * 2. Set `aria-hidden="true"` on `<main>` so screen readers
   *    can't reach the background content
   * 3. Intercept Tab/Shift+Tab and cycle focus within the drawer
   * 4. On Escape, close the drawer and return focus to the
   *    hamburger button
   */
  useEffect(() => {
    if (!mobileNavOpen) return;

    // (a) Set aria-hidden on the <main> behind the drawer
    const mainEl = document.getElementById("main-content");
    if (mainEl) mainEl.setAttribute("aria-hidden", "true");

    // (b) Focus the close button after a frame so React has
    //     finished mounting the drawer DOM.
    requestAnimationFrame(() => {
      drawerCloseRef.current?.focus();
    });

    // (c) Tab/Shift+Tab focus trap + Escape
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileNavOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const panel = drawerPanelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      if (mainEl) mainEl.removeAttribute("aria-hidden");
      // Return focus to the hamburger button on close.
      hamburgerRef.current?.focus();
    };
  }, [mobileNavOpen]);

  return (
    <>
      <main id="main-content" className="bg-white text-gray-900 dark:bg-slate-950 dark:text-slate-100">
        {/* NAV */}
        <header className="sticky top-0 z-50 border-b border-gray-200/60 bg-white/80 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/80">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link
              href="/"
              className="flex min-w-0 items-center rounded-md transition hover:opacity-90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#0072ce]/40"
            >
              <LeadSmartLogo className="h-8 w-auto max-w-[180px] sm:h-9 sm:max-w-[280px] lg:max-w-[320px]" />
            </Link>

            {/* Desktop section nav (md+) */}
            <nav
              className="hidden flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm lg:gap-x-6 md:flex"
              aria-label="Page sections"
            >
              {NAV_SECTIONS.map((item) => (
                <a
                  key={item.hash}
                  href={item.hash}
                  className="font-medium !text-gray-700 transition-colors hover:!text-[#0072ce] dark:!text-slate-300 dark:hover:!text-[#4da3e8]"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            {/* Right-side action cluster */}
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {/* Primary CTA — visible on sm+, hidden on the smallest viewports
                  so the hamburger has room. The drawer also exposes it. */}
              <Button
                size="sm"
                href={primaryCtaHref}
                className="hidden whitespace-nowrap sm:inline-flex"
              >
                Get My First Leads
              </Button>

              {/* Auth + support — shown md+ only, drawer shows them on mobile */}
              <div className="hidden items-center gap-2 sm:gap-3 md:flex">
                <HeaderAuthActions />
                <SupportChatLauncher buttonClassName="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200/90 bg-white text-gray-600 shadow-sm transition hover:border-[#0072ce]/40 hover:bg-gray-50 hover:text-[#0072ce] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0072ce]/40 sm:h-10 sm:w-10 sm:rounded-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-[#4da3e8]" />
              </div>

              {/* Hamburger — visible below md only */}
              <button
                ref={hamburgerRef}
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open menu"
                aria-expanded={mobileNavOpen}
                aria-controls="leadsmart-mobile-nav"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200/90 bg-white text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0072ce]/40 active:scale-[0.97] md:hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Mobile nav drawer */}
        {mobileNavOpen ? (
          <div
            className="fixed inset-0 z-[60] md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
          >
            {/* Backdrop — tap to close */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close menu"
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />

            {/* Panel — full height on iOS using `inset-y-0` instead of h-screen */}
            <div
              ref={drawerPanelRef}
              id="leadsmart-mobile-nav"
              className="absolute right-0 top-0 bottom-0 flex w-[86%] max-w-[340px] flex-col overflow-y-auto border-l border-slate-200/80 bg-white shadow-[-8px_0_48px_-12px_rgba(15,23,42,0.25)] dark:border-slate-800 dark:bg-slate-950"
              style={{
                // iOS Safari rounding: pad-bottom by safe-area-inset-bottom so
                // the last item isn't hidden by the home indicator, and use
                // 100dvh for the inner min-height so the address bar collapse
                // doesn't reflow the panel mid-scroll.
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
                minHeight: "100dvh",
              }}
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Menu</span>
                <button
                  ref={drawerCloseRef}
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close menu"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0072ce]/40 active:scale-[0.97] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Section anchor links */}
              <nav className="flex flex-col px-3 py-3" aria-label="Page sections (mobile)">
                {NAV_SECTIONS.map((item) => (
                  <a
                    key={item.hash}
                    href={item.hash}
                    onClick={() => setMobileNavOpen(false)}
                    className="rounded-xl px-3 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0072ce]/40 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>

              {/* Auth + primary CTA cluster */}
              <div className="mt-auto flex flex-col gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
                <Button
                  href={primaryCtaHref}
                  size="default"
                  className="w-full justify-center"
                  onClick={() => setMobileNavOpen(false)}
                >
                  Get My First Leads
                </Button>
                <div
                  className="flex items-center justify-center gap-2"
                  onClick={() => setMobileNavOpen(false)}
                >
                  <HeaderAuthActions />
                </div>
                <div className="flex justify-center pt-1">
                  <SupportChatLauncher buttonClassName="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200/90 bg-white text-gray-600 shadow-sm transition hover:border-[#0072ce]/40 hover:bg-gray-50 hover:text-[#0072ce] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0072ce]/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* HERO */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
          {/* Animated gradient mesh */}
          <div className="pointer-events-none absolute inset-0 -z-0" aria-hidden>
            <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-[0.15] blur-[100px] dark:opacity-[0.08]" style={{ background: "conic-gradient(from 180deg at 50% 50%, #0072ce 0deg, #4F46E5 120deg, #0072ce 240deg, #7c3aed 360deg)" }} />
            <div className="absolute right-0 top-1/4 h-[300px] w-[300px] rounded-full opacity-[0.06] blur-[80px]" style={{ background: "radial-gradient(circle, #ff8c42, transparent 70%)" }} />
          </div>

          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 py-16 md:grid-cols-2 md:gap-12 md:py-22 lg:py-28">
            <div className="max-w-xl lg:max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#0072ce]/20 bg-white/80 px-4 py-1.5 text-xs font-medium text-[#0072ce] shadow-sm backdrop-blur-sm dark:border-[#0072ce]/30 dark:bg-slate-900/80 dark:text-[#4da3e8]" style={{ animation: "fadeInUp 0.7s ease-out both" }}>
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0072ce] opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#0072ce]" /></span>
                AI-powered CRM for agents
              </div>
              <h1
                className="font-heading text-4xl font-extrabold leading-[1.08] tracking-tight text-gray-950 md:text-5xl lg:text-[3rem] dark:text-white"
                style={{ animation: "fadeInUp 0.7s ease-out 0.06s both" }}
              >
                The AI Deal Engine
                <br />
                <span className="bg-gradient-to-r from-[#0072ce] via-[#4F46E5] to-[#7c3aed] bg-clip-text text-transparent">for Real Estate</span>
              </h1>
              <p
                className="mt-5 text-lg leading-relaxed text-gray-600 md:text-xl dark:text-slate-400"
                style={{ animation: "fadeInUp 0.7s ease-out 0.12s both" }}
              >
                We don&apos;t just generate leads — we <strong className="text-gray-900 dark:text-white">turn them into closed deals automatically</strong>. Capture, qualify, and convert high-intent buyers and sellers with AI.
              </p>
              <p
                className="mt-5 text-base leading-relaxed text-gray-600 md:text-lg dark:text-slate-400"
                style={{ animation: "fadeInUp 0.6s ease-out 0.2s both" }}
              >
                Capture, qualify, and convert high-intent buyers and sellers with AI — so you can focus on closing, not
                chasing.
              </p>
              <div
                className="mt-8 flex flex-wrap gap-3"
                style={{ animation: "fadeInUp 0.6s ease-out 0.3s both" }}
              >
                <Button
                  href={primaryCtaHref}
                  aria-describedby="hero-trust-bar"
                  className="group relative min-h-[48px] overflow-hidden px-7 text-base shadow-lg shadow-[#0072ce]/20 hover:shadow-xl hover:shadow-[#0072ce]/30 sm:min-h-11 sm:px-6"
                >
                  {/* Subtle shimmer sweep — CSS-only. The pseudo
                    * element slides a white highlight across the
                    * button on a 3s loop, drawing the eye without
                    * being obnoxious. Pauses on hover so the
                    * interaction doesn't compete with the shimmer. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    style={{
                      animation: "cta-shimmer 3s ease-in-out infinite",
                    }}
                  />
                  Get My First Leads
                </Button>
                {hasVsl && (
                  <Button variant="outline" href={vslAnchorHref} className="min-h-11 px-6 text-base">
                    Watch 60s Demo
                  </Button>
                )}
              </div>

              {/*
               * Trust bar — the "Micro trust" label was a working name
               * leaking into production. Removed the label entirely and
               * also removed the redundant "No setup required / Works in
               * minutes" duplicate (those say the same thing). The three
               * check items speak for themselves.
               */}
              <div
                className="mt-6 rounded-xl border border-slate-200/80 bg-gradient-to-r from-[#0072ce]/[0.06] via-white to-[#ff8c42]/[0.07] px-4 py-4 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.04] dark:border-slate-700 dark:from-[#0072ce]/[0.08] dark:via-slate-900 dark:to-[#ff8c42]/[0.05] dark:ring-slate-700/40"
                style={{ animation: "fadeInUp 0.6s ease-out 0.4s both" }}
              >
                <ul id="hero-trust-bar" className="flex flex-col gap-2.5 text-sm text-slate-700 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-2 dark:text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <BrandCheck tone="primary" />
                    <span>AI follow-up in seconds — so hot leads don&apos;t go cold</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <BrandCheck tone="success" />
                    <span>Built for agents already running ads &amp; SEO</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <BrandCheck tone="accent" />
                    <span>Cancel anytime — no multi-year lock-in</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Dashboard preview — app window mockup */}
            <div
              className="rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-2xl shadow-slate-900/[0.1] dark:border-slate-700 dark:bg-slate-800"
              style={{ animation: "fadeInUp 0.8s ease-out 0.3s both" }}
            >
              {/* Window chrome */}
              <div className="flex items-center gap-2 rounded-t-xl border-b border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-red-400" /><div className="h-2.5 w-2.5 rounded-full bg-amber-400" /><div className="h-2.5 w-2.5 rounded-full bg-emerald-400" /></div>
                <span className="ml-2 text-[10px] font-medium text-slate-400">LeadSmart AI — Dashboard</span>
                <div className="ml-auto flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400">Live</span></div>
              </div>
              {/* Dashboard content */}
              <div className="space-y-3 p-4">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { n: "12", l: "New leads", color: "text-[#0072ce]", bg: "bg-[#0072ce]/5" },
                    { n: "94%", l: "Reply rate", color: "text-emerald-600", bg: "bg-emerald-50" },
                    { n: "8", l: "Tours booked", color: "text-[#4F46E5]", bg: "bg-[#4F46E5]/5" },
                  ].map(({ n, l, color, bg }) => (
                    <div key={l} className={`rounded-xl ${bg} p-3 text-center dark:bg-slate-700/50`}>
                      <p className={`text-2xl font-extrabold ${color}`}>{n}</p>
                      <p className="text-[10px] font-medium text-gray-500 dark:text-slate-400">{l}</p>
                    </div>
                  ))}
                </div>
                {/* Mini lead list */}
                <div className="space-y-1.5">
                  {[
                    { name: "Sarah M.", status: "Hot", emoji: "🔥", time: "2m ago" },
                    { name: "James W.", status: "Warm", emoji: "💬", time: "15m ago" },
                    { name: "Lisa K.", status: "New", emoji: "✨", time: "1h ago" },
                  ].map((lead) => (
                    <div key={lead.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-700/30">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{lead.emoji}</span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{lead.name}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${lead.status === "Hot" ? "bg-orange-100 text-orange-700" : lead.status === "Warm" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>{lead.status}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{lead.time}</span>
                    </div>
                  ))}
                </div>
                {/* Pipeline bar */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-medium text-slate-400">
                    <span>Pipeline health</span><span>72%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-[#0072ce] to-[#4F46E5]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <VslSection
          {...vslConfig}
          title="See the full system: traffic → reply → booked appointment"
          subtitle="Watch how LeadSmart AI qualifies and follows up so you show up first — without living in your inbox."
          ctaText="Get My First Leads"
          ctaHref={primaryCtaHref}
          trustText="No credit card required to start · Cancel anytime"
        />

        {/* PROBLEM */}
        <section
          id="problem"
          className="border-y border-rose-100 bg-gradient-to-b from-rose-50/90 via-white to-slate-50/80 px-6 py-16 text-center md:py-20 dark:border-rose-900/30 dark:from-rose-950/20 dark:via-slate-950 dark:to-slate-900/50"
        >
          <RevealSection className="mx-auto max-w-2xl">
            <h2 className="font-heading text-2xl font-bold leading-tight text-slate-900 md:text-3xl lg:text-[2rem] dark:text-white">
              You don&apos;t have a traffic problem.
            </h2>
            <p className="mt-4 font-heading text-xl font-bold text-rose-700 md:text-2xl dark:text-rose-400">
              You have a conversion problem.
            </p>
            <ul className="mx-auto mt-8 max-w-md space-y-3 text-left text-base text-slate-700 md:max-w-lg md:text-lg dark:text-slate-300">
              {[
                "Leads don't respond.",
                "Follow-ups are too slow.",
                "And high-intent clients choose someone else.",
              ].map((text, i) => (
                <RevealSection key={text} delay={i * 100}>
                  <li className="flex gap-3 border-l-4 border-rose-200 pl-4 dark:border-rose-800">
                    <span className="font-semibold text-rose-600 dark:text-rose-400">→</span>
                    <span>{text}</span>
                  </li>
                </RevealSection>
              ))}
            </ul>
            <p className="mt-10 font-heading text-lg font-bold leading-snug text-rose-800 md:text-xl dark:text-rose-300">
              Every missed response is a lost commission.
            </p>
          </RevealSection>
        </section>

        {/* SOLUTION */}
        <section
          id="solution"
          className="border-y border-emerald-100 bg-gradient-to-b from-emerald-50/95 via-white to-emerald-50/40 px-6 py-16 md:py-20 dark:border-emerald-900/30 dark:from-emerald-950/20 dark:via-slate-950 dark:to-slate-900/50"
        >
          <RevealSection className="mx-auto max-w-3xl text-center">
            <h2 className="font-heading text-2xl font-bold leading-tight text-slate-900 md:text-3xl lg:text-[2rem] dark:text-white">
              LeadSmart AI fixes the entire pipeline.
            </h2>
            <p className="mt-5 text-lg font-semibold text-slate-800 md:text-xl dark:text-slate-200">
              From first click to final deal —{" "}
              <span className="bg-gradient-to-r from-[#0072ce] to-[#4F46E5] bg-clip-text text-transparent">handled by AI.</span>
            </p>
            <ul className="mx-auto mt-10 max-w-md space-y-4 text-left text-base font-medium text-slate-800 md:max-w-lg md:text-lg dark:text-slate-200">
              {[
                { text: "No more chasing.", tone: "primary" as const },
                { text: "No more guessing.", tone: "success" as const },
                { text: "No more missed opportunities.", tone: "accent" as const },
              ].map((item, i) => (
                <RevealSection key={item.text} delay={i * 100}>
                  <li className="flex items-start gap-3 rounded-xl border border-emerald-100/80 bg-white/80 px-4 py-3 shadow-sm shadow-emerald-900/5 transition-all duration-200 hover:shadow-md dark:border-emerald-900/40 dark:bg-slate-800/60">
                    <BrandCheck tone={item.tone} />
                    <span>{item.text}</span>
                  </li>
                </RevealSection>
              ))}
            </ul>
          </RevealSection>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="px-6 py-16 dark:bg-slate-950">
          <div className="mx-auto grid max-w-7xl items-center gap-10 md:grid-cols-2">
            <RevealSection>
              <h2 className="font-heading text-2xl font-semibold md:text-3xl dark:text-white">How It Works</h2>
              <ul className="mt-6 space-y-4 text-gray-600 dark:text-slate-400">
                {(
                  [
                    { n: 1, label: "Attract traffic", tone: "primary" as const },
                    { n: 2, label: "Capture leads", tone: "primaryDark" as const },
                    { n: 3, label: "AI follows up instantly", tone: "success" as const },
                    { n: 4, label: "You close the deal", tone: "accent" as const },
                  ] as const
                ).map((step, i) => (
                  <RevealSection key={step.n} delay={i * 80}>
                    <li className="flex gap-3">
                      <BrandCheck tone={step.tone} size="md" />
                      <span className="pt-0.5">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{step.n}.</span> {step.label}
                      </span>
                    </li>
                  </RevealSection>
                ))}
              </ul>
            </RevealSection>
            <RevealSection delay={150} className="flex min-h-[16rem] items-center justify-center">
              <figure className="w-full max-w-xl lg:max-w-none">
                <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/5 transition-all duration-300 hover:shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:ring-slate-700/40">
                  <Image
                    src="/images/ProcessDiagram.png"
                    alt="How LeadSmart AI works: from traffic through capture and nurture to closed deals"
                    width={1200}
                    height={800}
                    className="h-auto w-full object-contain"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
                <figcaption className="sr-only">
                  Process diagram: attract traffic, capture leads, AI follow-up, and you close the deal.
                </figcaption>
              </figure>
            </RevealSection>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="bg-slate-50/70 px-6 py-16 md:py-20 dark:bg-slate-900/30">
          <div className="mx-auto max-w-7xl">
            <RevealSection className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-2xl font-semibold md:text-3xl dark:text-white">
                Close More Deals with Less Work
              </h2>
              <p className="mt-3 text-base text-gray-600 md:text-lg dark:text-slate-400">
                Every feature built specifically for real estate agents — not generic sales teams.
              </p>
            </RevealSection>
            {/*
             * Feature cards — icons migrated from emoji (⚡🧠📊🔄) to Lucide
             * SVG icons. Emoji render differently across OS (Apple vs Google
             * vs Windows), can't respect brand color, and signaled "MVP built
             * in a weekend" on a product asking for credit card details.
             * Each card has a unique tinted chip background + brand-colored
             * stroke so the grid reads as a coordinated icon set rather than
             * four mismatched emoji.
             */}
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {([
                {
                  accent: "primary",
                  icon: <Zap size={22} strokeWidth={2} aria-hidden />,
                  title: "Instant AI Follow-Up",
                  description:
                    "Respond to every new lead in under 60 seconds — automatically, day or night. Never lose a hot lead to a faster competitor.",
                  bullets: ["SMS + email replies", "Personalized by source", "24/7 automation"],
                  chipBg: "bg-blue-50",
                  chipText: "text-[#0072ce]",
                },
                {
                  accent: "primaryDark",
                  icon: <Brain size={22} strokeWidth={2} aria-hidden />,
                  title: "Smart Lead Scoring",
                  description:
                    "AI ranks every lead by buying intent so you spend your time on the people most likely to close — not tire-kickers.",
                  bullets: ["Behavioral scoring", "Hot / warm / cold labels", "Priority inbox view"],
                  chipBg: "bg-violet-50",
                  chipText: "text-violet-600",
                },
                {
                  accent: "success",
                  icon: <BarChart3 size={22} strokeWidth={2} aria-hidden />,
                  title: "Live Pipeline Dashboard",
                  description:
                    "See every lead, every follow-up, and every scheduled tour in one place. Know exactly where your pipeline stands.",
                  bullets: ["Stage-by-stage tracking", "Tour & offer milestones", "Team visibility"],
                  chipBg: "bg-emerald-50",
                  chipText: "text-emerald-600",
                },
                {
                  accent: "accent",
                  icon: <Repeat2 size={22} strokeWidth={2} aria-hidden />,
                  title: "Drip Automation",
                  description:
                    "Multi-step nurture sequences keep leads warm for weeks without you lifting a finger — until they're ready to buy.",
                  bullets: ["Preset + custom drips", "Auto pause on reply", "CRM sync"],
                  chipBg: "bg-amber-50",
                  chipText: "text-amber-600",
                },
              ] as {
                accent: "primary" | "primaryDark" | "success" | "accent";
                icon: ReactNode;
                title: string;
                description: string;
                bullets: string[];
                chipBg: string;
                chipText: string;
              }[]).map((f, i) => (
                <RevealSection key={f.title} delay={i * 100}>
                  <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/[0.06] dark:border-slate-700 dark:bg-slate-900 dark:hover:shadow-[#0072ce]/[0.08]">
                    {/* Gradient overlay on hover */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#0072ce]/[0.02] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl ${f.chipBg} ${f.chipText}`}>
                      {f.icon}
                    </div>
                    <h3 className="font-heading text-base font-bold text-slate-900 dark:text-white">{f.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{f.description}</p>
                    <ul className="mt-5 space-y-2">
                      {f.bullets.map((b) => (
                        <li key={b} className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                          <BrandCheck tone={f.accent} />
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

        {/*
         * SOCIAL PROOF — removed until we have real testimonials with
         * full names + headshots + brokerage.
         *
         * The previous version used "Marcus T. / Priya R. / Jason M."
         * with city + initials, which is the canonical pattern for
         * fabricated stock testimonials. For a CRM that sells "trust our
         * AI with your leads," placeholder social proof is actively
         * harmful — it signals the product isn't real and undermines
         * every other trust signal on the page. Better to have NO
         * testimonials than ones that look fake.
         *
         * When to restore: once we have at least 3 real customers
         * willing to be quoted with full name, real headshot photo,
         * brokerage logo/name, and ideally a LinkedIn link. Optionally
         * add a "Case studies" link or pilot results block in the
         * meantime (clearly labeled as internal data, not a customer).
         */}

        {/* PRICING */}
        <section id="pricing" className="px-6 py-16 md:py-20 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl text-center">
            <RevealSection>
              <h2 className="font-heading text-2xl font-semibold md:text-3xl dark:text-white">Start Closing Deals Today</h2>
              <p className="mt-2 text-gray-600 dark:text-slate-400">Simple pricing. No contracts. Cancel anytime.</p>
            </RevealSection>

            {/*
             * Monthly / Annual billing toggle. Annual = monthly × 10
             * (two months free, ~17% savings). Pricing is computed
             * inline per-card from the cycle state so we don't have
             * to maintain a separate plan table.
             */}
            <RevealSection delay={50}>
              <div className="mt-8 flex flex-col items-center gap-3">
                <div
                  role="tablist"
                  aria-label="Billing cycle"
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={billingCycle === "monthly"}
                    onClick={() => setBillingCycle("monthly")}
                    className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
                      billingCycle === "monthly"
                        ? "bg-gradient-to-r from-[#0072ce] to-[#4F46E5] text-white shadow"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={billingCycle === "annual"}
                    onClick={() => setBillingCycle("annual")}
                    className={`flex items-center gap-2 rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
                      billingCycle === "annual"
                        ? "bg-gradient-to-r from-[#0072ce] to-[#4F46E5] text-white shadow"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    Annual
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        billingCycle === "annual"
                          ? "bg-white/20 text-white"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      }`}
                    >
                      Save 17%
                    </span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-500">
                  {billingCycle === "annual"
                    ? "Billed yearly — two months free vs monthly"
                    : "Switch to annual billing for 2 months free"}
                </p>
              </div>
            </RevealSection>

            <div className="mx-auto mt-10 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {/* Free */}
              <RevealSection delay={0}>
                <Card className="h-full dark:border-slate-700 dark:bg-slate-900">
                  <CardContent className="p-5 text-left">
                    <h3 className="font-heading text-base font-semibold dark:text-white">Free</h3>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">$0 <span className="text-xs font-normal text-gray-500 dark:text-slate-400">forever</span></p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">Test the platform and see leads flow in.</p>
                    <ul className="mt-4 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                      {["25 leads/month", "Email follow-up only", "Pipeline dashboard", "Basic lead scoring", "1 drip sequence"].map((f) => (
                        <li key={f} className="flex items-center gap-2"><BrandCheck tone="primary" />{f}</li>
                      ))}
                    </ul>
                    <Button className="mt-5 w-full text-xs" variant="outline" href="/signup" aria-label="Get started free — Free plan at $0 per month">Get started free</Button>
                  </CardContent>
                </Card>
              </RevealSection>
              {/* Pro — Featured */}
              <RevealSection delay={100}>
                <Card className="relative h-full scale-[1.02] border-2 border-[#0072ce] ring-2 ring-[#0072ce]/10 dark:border-[#4da3e8] dark:bg-slate-900 dark:ring-[#0072ce]/20">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#0072ce] to-[#4F46E5] px-3 py-0.5 text-xs font-semibold text-white shadow-md">Most Popular</div>
                  <CardContent className="p-5 text-left">
                    <h3 className="font-heading text-base font-semibold dark:text-white">Pro</h3>
                    <div className="mt-1 flex items-baseline gap-2">
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        ${billingCycle === "annual" ? 41 : 49}{" "}
                        <span className="text-xs font-normal text-gray-500 dark:text-slate-400">/mo</span>
                      </p>
                      {billingCycle === "annual" && (
                        <span className="text-xs font-normal text-gray-400 line-through dark:text-slate-500">$49</span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-500">
                      {billingCycle === "annual" ? "$490 billed yearly" : "Billed monthly"}
                    </p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">Full CRM and AI for active agents.</p>
                    <ul className="mt-4 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                      {["500 leads/month", "SMS + email AI follow-up", "Advanced lead scoring", "Unlimited drip sequences", "Tour & offer tracking", "CRM integrations"].map((f) => (
                        <li key={f} className="flex items-center gap-2"><BrandCheck tone="primary" />{f}</li>
                      ))}
                    </ul>
                    <Button className="mt-5 w-full text-xs shadow-lg shadow-[#0072ce]/20" href={`/pricing?checkout_plan=pro&cycle=${billingCycle}`} aria-label={`Start free trial — Pro plan at $${billingCycle === "annual" ? 41 : 49} per month`}>Start free trial</Button>
                    <p className="mt-1.5 text-center text-[11px] text-gray-400 dark:text-slate-500">14-day trial · No card needed</p>
                  </CardContent>
                </Card>
              </RevealSection>
              {/* Elite */}
              <RevealSection delay={200}>
                <Card className="h-full dark:border-slate-700 dark:bg-slate-900">
                  <CardContent className="p-5 text-left">
                    <h3 className="font-heading text-base font-semibold dark:text-white">Elite</h3>
                    <div className="mt-1 flex items-baseline gap-2">
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        ${billingCycle === "annual" ? 82 : 99}{" "}
                        <span className="text-xs font-normal text-gray-500 dark:text-slate-400">/mo</span>
                      </p>
                      {billingCycle === "annual" && (
                        <span className="text-xs font-normal text-gray-400 line-through dark:text-slate-500">$99</span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-500">
                      {billingCycle === "annual" ? "$990 billed yearly" : "Billed monthly"}
                    </p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">For top producers closing 10+ deals/month.</p>
                    <ul className="mt-4 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                      {["Unlimited leads", "Priority AI routing", "Multi-channel automation", "Predictive lead scoring", "Custom drip campaigns", "Dedicated onboarding"].map((f) => (
                        <li key={f} className="flex items-center gap-2"><BrandCheck tone="success" />{f}</li>
                      ))}
                    </ul>
                    <Button className="mt-5 w-full text-xs" variant="outline" href={`/pricing?checkout_plan=premium&cycle=${billingCycle}`} aria-label={`Start free trial — Elite plan at $${billingCycle === "annual" ? 82 : 99} per month`}>Start free trial</Button>
                  </CardContent>
                </Card>
              </RevealSection>
              {/* Team */}
              <RevealSection delay={300}>
                <Card className="h-full dark:border-slate-700 dark:bg-slate-900">
                  <CardContent className="p-5 text-left">
                    <h3 className="font-heading text-base font-semibold dark:text-white">Team</h3>
                    <div className="mt-1 flex items-baseline gap-2">
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        ${billingCycle === "annual" ? 165 : 199}{" "}
                        <span className="text-xs font-normal text-gray-500 dark:text-slate-400">/mo</span>
                      </p>
                      {billingCycle === "annual" && (
                        <span className="text-xs font-normal text-gray-400 line-through dark:text-slate-500">$199</span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-500">
                      {billingCycle === "annual" ? "$1,990 billed yearly" : "Billed monthly"}
                    </p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">Multiple agents, one shared pipeline.</p>
                    <ul className="mt-4 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                      {["Up to 10 agents", "Shared lead pool & routing", "Team performance dashboard", "Admin controls", "White-label option", "Priority support SLA"].map((f) => (
                        <li key={f} className="flex items-center gap-2"><BrandCheck tone="accent" />{f}</li>
                      ))}
                    </ul>
                    <Button className="mt-5 w-full text-xs" variant="outline" href="/contact" aria-label={`Contact sales — Team plan at $${billingCycle === "annual" ? 165 : 199} per month`}>Contact sales</Button>
                  </CardContent>
                </Card>
              </RevealSection>
            </div>
            <p className="mt-6 text-sm text-gray-500 dark:text-slate-400">
              See the full feature comparison →{" "}
              <a href="/pricing" className="font-semibold text-[#0072ce] hover:underline dark:text-[#4da3e8]">View all plans</a>
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-slate-50 px-6 py-16 md:py-20 dark:bg-slate-900/30">
          <div className="mx-auto max-w-3xl">
            <RevealSection>
              <h2 className="text-center font-heading text-2xl font-semibold md:text-3xl dark:text-white">Common Questions</h2>
            </RevealSection>
            <div className="mt-10 space-y-6">
              {[
                {
                  q: "How does the AI follow-up actually work?",
                  a: "When a new lead comes in from any source — your website, Zillow, Facebook, etc. — LeadSmart AI sends a personalized text and email within 60 seconds. The message is tailored to where they came from and what they were looking at. If they reply, AI continues the conversation and qualifies them before handing off to you.",
                },
                {
                  q: "Does it integrate with my current CRM or website?",
                  a: "Yes. LeadSmart AI connects with major real estate CRMs (Follow Up Boss, kvCORE, Sierra Interactive, and more) via Zapier or native integrations. Your website lead forms, Zillow, and Facebook Lead Ads all flow in automatically. Setup typically takes under 15 minutes.",
                },
                {
                  q: "What happens after the free trial?",
                  a: "You choose a plan — or you don't. There's no auto-charge after the trial ends. If you upgrade to Pro, your leads, sequences, and pipeline history carry over seamlessly. If you stay on the Free plan, you keep up to 25 leads/month with core features.",
                },
                {
                  q: "Will leads know they're talking to AI?",
                  a: "LeadSmart AI is designed to be transparent. Messages are sent in your name and from your number. When a lead is ready to connect, you're looped in immediately. You can customize exactly how much AI handles before you take over.",
                },
                {
                  q: "How is this different from a standard CRM?",
                  a: "Most CRMs track what happened. LeadSmart AI acts on it. Instead of logging a lead and setting a manual reminder, our AI sends the first message, qualifies the lead, books a call if they're ready, and only escalates to you when there's real buying intent — saving you hours every week.",
                },
              ].map((item, i) => (
                <RevealSection key={i} delay={i * 60}>
                  <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
                    <h3 className="font-heading text-base font-semibold text-slate-900 dark:text-white">{item.q}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{item.a}</p>
                  </div>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="relative overflow-hidden py-24 text-center text-white md:py-32">
          <div className="absolute inset-0 -z-10 bg-gray-950" />
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
            <div className="absolute left-1/2 top-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.12] blur-[100px]" style={{ background: "conic-gradient(from 0deg at 50% 50%, #0072ce 0deg, #4F46E5 120deg, #7c3aed 240deg, #0072ce 360deg)" }} />
          </div>
          <RevealSection>
            <h2 className="font-heading text-3xl font-extrabold md:text-4xl lg:text-5xl">Stop Losing Deals</h2>
            <p className="mt-4 text-lg text-gray-400">Start converting leads automatically — no setup, no code, no contracts</p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button className="shadow-xl shadow-[#0072ce]/20 px-8 py-3 text-base" href={primaryCtaHref}>
                Get My First Leads
              </Button>
              <Button variant="inverse" href="/pricing" className="px-8 py-3 text-base">
                Compare Plans
              </Button>
            </div>
          </RevealSection>
        </section>

        {/*
         * Footer — expanded to a 4-column layout (Product / Tools /
         * Company / Legal) for the Batch 2 audit. The earlier single-
         * row nav collapsed all links into one list, which hurt
         * discoverability of the free calculators and made the site
         * look unfinished. On mobile the columns stack as a 2×2 grid.
         */}
        <footer className="border-t border-gray-200 bg-white px-6 py-12 dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-2 gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
              {/* Brand column */}
              <div className="col-span-2 md:col-span-1">
                <LeadSmartLogo compact className="max-w-[200px] opacity-90" priority={false} />
                <p className="mt-4 max-w-xs text-sm text-gray-600 dark:text-slate-400">
                  AI-powered lead follow-up, scoring, and pipeline management built for top-producing real estate agents.
                </p>
              </div>

              {/* Product */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-200">Product</h3>
                <ul className="mt-4 space-y-2 text-sm">
                  {[
                    { label: "Features", href: "#features" },
                    { label: "Pricing", href: "/pricing" },
                    { label: "How it works", href: "#how" },
                    { label: "Sign in", href: "/login" },
                    { label: "Get started", href: "/signup" },
                  ].map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="!text-gray-600 transition-colors hover:!text-[#0072ce] dark:!text-slate-400 dark:hover:!text-[#4da3e8]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Free Tools */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-200">Free Tools</h3>
                <ul className="mt-4 space-y-2 text-sm">
                  {[
                    { label: "Mortgage Calculator", href: "/mortgage-calculator" },
                    { label: "Affordability Calculator", href: "/affordability-calculator" },
                    { label: "Rent vs Buy", href: "/rent-vs-buy-calculator" },
                    { label: "Down Payment", href: "/down-payment-calculator" },
                    { label: "Cash Flow", href: "/cash-flow-calculator" },
                  ].map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="!text-gray-600 transition-colors hover:!text-[#0072ce] dark:!text-slate-400 dark:hover:!text-[#4da3e8]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Company */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-200">Company</h3>
                <ul className="mt-4 space-y-2 text-sm">
                  {[
                    { label: "About", href: "/about" },
                    { label: "Contact", href: "/contact" },
                    { label: "Support", href: "/support" },
                  ].map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="!text-gray-600 transition-colors hover:!text-[#0072ce] dark:!text-slate-400 dark:hover:!text-[#4da3e8]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Legal */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-200">Legal</h3>
                <ul className="mt-4 space-y-2 text-sm">
                  {[
                    { label: "Privacy", href: "/privacy" },
                    { label: "Terms", href: "/terms" },
                  ].map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="!text-gray-600 transition-colors hover:!text-[#0072ce] dark:!text-slate-400 dark:hover:!text-[#4da3e8]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-gray-100 pt-6 text-xs text-gray-500 dark:border-slate-800/80 dark:text-slate-500 sm:flex-row">
              <p>&copy; {new Date().getFullYear()} LeadSmart AI. All rights reserved.</p>
              <p>Built for top-producing real estate agents.</p>
            </div>
          </div>
        </footer>
      </main>

      <ExitIntentPopup role="agent" />
    </>
  );
}
