"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LeadSmartLogo } from "@/components/brand/LeadSmartLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FeatureHighlightCard } from "@/components/ui/FeatureHighlightCard";
import { BrandCheck } from "@/components/brand/BrandCheck";
import ExitIntentPopup from "@/components/marketing/ExitIntentPopup";
import HeaderAuthActions from "@/components/HeaderAuthActions";
import { SupportChatLauncher } from "@/components/support/CustomerSupportChat";
import VslSection from "@/components/VslSection";

const primaryCtaHref = "/onboarding";
const vslAnchorHref = "#vsl";

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

  return (
    <>
      <main className="bg-white text-gray-900 dark:bg-slate-950 dark:text-slate-100">
        {/* NAV */}
        <header className="sticky top-0 z-50 border-b border-gray-200/60 bg-white/80 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/80">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <Link
              href="/"
              className="flex items-center rounded-md transition hover:opacity-90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#0072ce]/40"
            >
              <LeadSmartLogo className="max-w-[min(100%,280px)] sm:max-w-[min(100%,320px)]" />
            </Link>
            <nav className="hidden flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm lg:gap-x-6 md:flex" aria-label="Page sections">
              {["Problem", "Solution", "How It Works", "Features", "Pricing"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(/\s+/g, "").replace("howitworks", "how")}`}
                  className="font-medium !text-gray-700 transition-colors hover:!text-[#0072ce] dark:!text-slate-300 dark:hover:!text-[#4da3e8]"
                >
                  {item}
                </a>
              ))}
            </nav>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <SupportChatLauncher buttonClassName="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200/90 bg-white text-gray-600 shadow-sm transition hover:border-[#0072ce]/40 hover:bg-gray-50 hover:text-[#0072ce] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0072ce]/40 sm:h-10 sm:w-10 sm:rounded-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-[#4da3e8]" />
              <Button size="sm" href={primaryCtaHref} className="whitespace-nowrap">
                Get My First Leads
              </Button>
              <HeaderAuthActions />
            </div>
          </div>
        </header>

        {/* HERO */}
        <section className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-slate-50 via-white to-white dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
          {/* Gradient orbs */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            aria-hidden
            style={{
              backgroundImage:
                "radial-gradient(ellipse 90% 60% at 50% -30%, rgba(0,114,206,0.18), transparent 55%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            aria-hidden
            style={{
              backgroundImage:
                "radial-gradient(ellipse 40% 40% at 85% 15%, rgba(79,70,229,0.1), transparent 50%)",
            }}
          />

          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 py-16 md:grid-cols-2 md:gap-12 md:py-22 lg:py-28">
            <div className="max-w-xl lg:max-w-2xl">
              <h1
                className="font-heading text-4xl font-bold leading-[1.1] tracking-tight text-gray-950 md:text-5xl lg:text-[2.75rem] dark:text-white"
                style={{ animation: "fadeInUp 0.6s ease-out both" }}
              >
                The AI Deal Engine for Real Estate
              </h1>
              <p
                className="mt-5 text-xl font-semibold text-gray-900 md:text-2xl md:leading-snug dark:text-slate-200"
                style={{ animation: "fadeInUp 0.6s ease-out 0.1s both" }}
              >
                We don&apos;t just generate leads.
              </p>
              <p
                className="mt-2 text-xl font-semibold leading-snug md:text-2xl"
                style={{ animation: "fadeInUp 0.6s ease-out 0.15s both" }}
              >
                <span className="bg-gradient-to-r from-[#0072ce] to-[#4F46E5] bg-clip-text text-transparent">
                  We turn them into closed deals — automatically.
                </span>
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
                <Button href={primaryCtaHref} className="min-h-11 px-6 text-base shadow-lg shadow-[#0072ce]/20 hover:shadow-xl hover:shadow-[#0072ce]/30">
                  Get My First Leads
                </Button>
                {hasVsl && (
                  <Button variant="outline" href={vslAnchorHref} className="min-h-11 px-6 text-base">
                    Watch 60s Demo
                  </Button>
                )}
              </div>

              {/* Micro trust */}
              <div
                className="mt-6 rounded-xl border border-slate-200/80 bg-gradient-to-r from-[#0072ce]/[0.06] via-white to-[#ff8c42]/[0.07] pt-6 pl-4 pr-3 pb-4 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.04] dark:border-slate-700 dark:from-[#0072ce]/[0.08] dark:via-slate-900 dark:to-[#ff8c42]/[0.05] dark:ring-slate-700/40"
                style={{ animation: "fadeInUp 0.6s ease-out 0.4s both" }}
              >
                <div className="flex items-center gap-2 border-l-4 border-[#0072ce] pl-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#005ca8] dark:text-[#4da3e8]">
                    <span aria-hidden>🧠</span> Micro trust
                  </p>
                </div>
                <p className="mt-3 pl-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  No setup required{" "}
                  <span className="text-[#0072ce]" aria-hidden>
                    •
                  </span>{" "}
                  Works in minutes
                </p>
                <ul className="mt-3 flex flex-col gap-2.5 text-sm text-slate-700 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-2 dark:text-slate-300">
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

            {/* Dashboard preview */}
            <div
              className="flex h-72 items-center justify-center rounded-2xl border border-gray-200 bg-gradient-to-br from-slate-100 to-slate-200/80 p-6 shadow-inner md:h-80 dark:border-slate-700 dark:from-slate-800 dark:to-slate-900"
              style={{ animation: "fadeInUp 0.7s ease-out 0.35s both" }}
            >
              <div className="w-full max-w-md rounded-xl border border-white/80 bg-white p-4 shadow-lg dark:border-slate-600 dark:bg-slate-800">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Dashboard preview</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    ["12", "New leads"],
                    ["94%", "Reply rate"],
                    ["8", "Tours booked"],
                  ].map(([n, l]) => (
                    <div key={l} className="rounded-lg bg-slate-50 px-2 py-3 transition-all duration-200 hover:shadow-sm dark:bg-slate-700/50">
                      <p className="text-xl font-bold text-[#0072ce]">{n}</p>
                      <p className="text-[10px] font-medium text-gray-500 dark:text-slate-400">{l}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-[#0072ce] to-[#4F46E5] transition-all duration-1000" />
                </div>
                <p className="mt-2 text-center text-[11px] text-gray-400 dark:text-slate-500">Pipeline health · live</p>
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
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  accent: "primary" as const,
                  emoji: "⚡",
                  title: "Instant AI Follow-Up",
                  description:
                    "Respond to every new lead in under 60 seconds — automatically, day or night. Never lose a hot lead to a faster competitor.",
                  bullets: ["SMS + email replies", "Personalized by source", "24/7 automation"],
                },
                {
                  accent: "primaryDark" as const,
                  emoji: "🧠",
                  title: "Smart Lead Scoring",
                  description:
                    "AI ranks every lead by buying intent so you spend your time on the people most likely to close — not tire-kickers.",
                  bullets: ["Behavioral scoring", "Hot / warm / cold labels", "Priority inbox view"],
                },
                {
                  accent: "success" as const,
                  emoji: "📊",
                  title: "Live Pipeline Dashboard",
                  description:
                    "See every lead, every follow-up, and every scheduled tour in one place. Know exactly where your pipeline stands.",
                  bullets: ["Stage-by-stage tracking", "Tour & offer milestones", "Team visibility"],
                },
                {
                  accent: "accent" as const,
                  emoji: "🔄",
                  title: "Drip Automation",
                  description:
                    "Multi-step nurture sequences keep leads warm for weeks without you lifting a finger — until they're ready to buy.",
                  bullets: ["Preset + custom drips", "Auto pause on reply", "CRM sync"],
                },
              ].map((f, i) => (
                <RevealSection key={f.title} delay={i * 100}>
                  <div className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-900/[0.08] dark:border-slate-700 dark:bg-slate-900 dark:hover:shadow-[#0072ce]/[0.1]">
                    <div className="mb-4 text-3xl">{f.emoji}</div>
                    <h3 className="font-heading text-base font-semibold text-slate-900 dark:text-white">{f.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{f.description}</p>
                    <ul className="mt-4 space-y-1.5">
                      {f.bullets.map((b) => (
                        <li key={b} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
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

        {/* SOCIAL PROOF */}
        <section className="bg-gradient-to-b from-white to-slate-50 px-6 py-16 md:py-20 dark:from-slate-950 dark:to-slate-900/50">
          <div className="mx-auto max-w-6xl text-center">
            <RevealSection>
              <h2 className="font-heading text-2xl font-semibold md:text-3xl dark:text-white">What Agents Are Saying</h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">Results from early-access agents who replaced their old CRM</p>
            </RevealSection>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {[
                {
                  quote: "Got 12 qualified leads in my first 7 days. AI follow-up got replies I never would have gotten manually.",
                  name: "Marcus T.",
                  role: "Buyer's Agent · Austin, TX",
                  tone: "primary" as const,
                },
                {
                  quote: "My response rate doubled overnight. Leads used to ghost me — now I show up first before they even call another agent.",
                  name: "Priya R.",
                  role: "Realtor · Miami, FL",
                  tone: "success" as const,
                },
                {
                  quote: "Finally, leads that actually convert. The scoring tells me who's serious so I stop wasting time on cold inquiries.",
                  name: "Jason M.",
                  role: "Team Lead · Denver, CO",
                  tone: "accent" as const,
                },
              ].map((t, i) => (
                <RevealSection key={t.name} delay={i * 100}>
                  <div className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-6 text-left shadow-sm transition-all duration-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
                    <div className="mb-4">
                      <BrandCheck tone={t.tone} />
                    </div>
                    <blockquote className="flex-1 text-sm leading-relaxed text-slate-700 italic dark:text-slate-300">
                      &ldquo;{t.quote}&rdquo;
                    </blockquote>
                    <footer className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.role}</p>
                    </footer>
                  </div>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="px-6 py-16 md:py-20 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl text-center">
            <RevealSection>
              <h2 className="font-heading text-2xl font-semibold md:text-3xl dark:text-white">Start Closing Deals Today</h2>
              <p className="mt-2 text-gray-600 dark:text-slate-400">Simple pricing. No contracts. Cancel anytime.</p>
            </RevealSection>
            <div className="mx-auto mt-10 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {/* Free */}
              <RevealSection delay={0}>
                <Card className="h-full dark:border-slate-700 dark:bg-slate-900">
                  <CardContent className="p-5 text-left">
                    <h3 className="font-heading text-base font-semibold dark:text-white">Free</h3>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">$0 <span className="text-xs font-normal text-gray-500 dark:text-slate-400">/mo</span></p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">Test the platform and see leads flow in.</p>
                    <ul className="mt-4 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                      {["25 leads/month", "Email follow-up only", "Pipeline dashboard", "Basic lead scoring", "1 drip sequence"].map((f) => (
                        <li key={f} className="flex items-center gap-2"><BrandCheck tone="primary" />{f}</li>
                      ))}
                    </ul>
                    <Button className="mt-5 w-full text-xs" variant="outline" href={primaryCtaHref}>Get started free</Button>
                  </CardContent>
                </Card>
              </RevealSection>
              {/* Pro — Featured */}
              <RevealSection delay={100}>
                <Card className="relative h-full scale-[1.02] border-2 border-[#0072ce] ring-2 ring-[#0072ce]/10 dark:border-[#4da3e8] dark:bg-slate-900 dark:ring-[#0072ce]/20">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#0072ce] to-[#4F46E5] px-3 py-0.5 text-xs font-semibold text-white shadow-md">Most Popular</div>
                  <CardContent className="p-5 text-left">
                    <h3 className="font-heading text-base font-semibold dark:text-white">Pro</h3>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">$49 <span className="text-xs font-normal text-gray-500 dark:text-slate-400">/mo</span></p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">Full CRM and AI for active agents.</p>
                    <ul className="mt-4 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                      {["500 leads/month", "SMS + email AI follow-up", "Advanced lead scoring", "Unlimited drip sequences", "Tour & offer tracking", "CRM integrations"].map((f) => (
                        <li key={f} className="flex items-center gap-2"><BrandCheck tone="primary" />{f}</li>
                      ))}
                    </ul>
                    <Button className="mt-5 w-full text-xs shadow-lg shadow-[#0072ce]/20" href="/pricing">Start free trial</Button>
                    <p className="mt-1.5 text-center text-[11px] text-gray-400 dark:text-slate-500">14-day trial · No card needed</p>
                  </CardContent>
                </Card>
              </RevealSection>
              {/* Elite */}
              <RevealSection delay={200}>
                <Card className="h-full dark:border-slate-700 dark:bg-slate-900">
                  <CardContent className="p-5 text-left">
                    <h3 className="font-heading text-base font-semibold dark:text-white">Elite</h3>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">$99 <span className="text-xs font-normal text-gray-500 dark:text-slate-400">/mo</span></p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">For top producers closing 10+ deals/month.</p>
                    <ul className="mt-4 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                      {["Unlimited leads", "Priority AI routing", "Multi-channel automation", "Predictive lead scoring", "Custom drip campaigns", "Dedicated onboarding"].map((f) => (
                        <li key={f} className="flex items-center gap-2"><BrandCheck tone="success" />{f}</li>
                      ))}
                    </ul>
                    <Button className="mt-5 w-full text-xs" variant="outline" href="/pricing">Start free trial</Button>
                  </CardContent>
                </Card>
              </RevealSection>
              {/* Team */}
              <RevealSection delay={300}>
                <Card className="h-full dark:border-slate-700 dark:bg-slate-900">
                  <CardContent className="p-5 text-left">
                    <h3 className="font-heading text-base font-semibold dark:text-white">Team</h3>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">$199 <span className="text-xs font-normal text-gray-500 dark:text-slate-400">/mo</span></p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">Multiple agents, one shared pipeline.</p>
                    <ul className="mt-4 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                      {["Up to 10 agents", "Shared lead pool & routing", "Team performance dashboard", "Admin controls", "White-label option", "Priority support SLA"].map((f) => (
                        <li key={f} className="flex items-center gap-2"><BrandCheck tone="accent" />{f}</li>
                      ))}
                    </ul>
                    <Button className="mt-5 w-full text-xs" variant="outline" href="/contact">Contact sales</Button>
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
                  a: "You choose a plan — or you don't. There's no auto-charge after the trial ends. If you upgrade to Pro, your leads, sequences, and pipeline history carry over seamlessly. If you stay on Starter (free), you keep up to 25 leads/month with core features.",
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
        <section className="bg-gradient-to-br from-gray-900 via-gray-900 to-[#0072ce]/30 py-20 text-center text-white">
          <RevealSection>
            <h2 className="font-heading text-3xl font-semibold">Stop Losing Deals</h2>
            <p className="mt-4 text-gray-300">Start converting leads automatically</p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button className="shadow-lg" href={primaryCtaHref}>
                Get My First Leads
              </Button>
              <Button variant="inverse" href="/pricing">
                Compare Plans
              </Button>
            </div>
          </RevealSection>
        </section>

        {/* Footer — uses shared Footer component from layout, but landing has its own inline */}
        <footer className="border-t border-gray-200 bg-white px-6 py-10 dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
              <LeadSmartLogo compact className="max-w-[220px] opacity-90" priority={false} />
              <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">&copy; {new Date().getFullYear()} LeadSmart AI</p>
            </div>
            <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
              {[
                { label: "Contact", href: "/contact" },
                { label: "Privacy", href: "/privacy" },
                { label: "Terms", href: "/terms" },
                { label: "Pricing", href: "/pricing" },
                { label: "About", href: "/about" },
                { label: "Blog", href: "/blog" },
              ].map((link) => (
                <Link key={link.label} href={link.href} className="!text-gray-600 transition-colors hover:!text-[#0072ce] dark:!text-slate-400 dark:hover:!text-[#4da3e8]">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </footer>
      </main>

      <ExitIntentPopup role="agent" />
    </>
  );
}
