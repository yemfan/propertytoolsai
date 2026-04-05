"use client";

import Image from "next/image";
import Link from "next/link";
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
/** In-page anchor — hero “Watch 60s Demo” scrolls to VSL (LeadSmart AI Demo player). */
const vslAnchorHref = "#vsl";

/** VSL: MP4 > Vimeo > YouTube (`NEXT_PUBLIC_*` env vars). */
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
      <main className="bg-white text-gray-900">
        {/* NAV */}
        <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <Link
              href="/"
              className="flex items-center transition hover:opacity-90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#0072ce]/40 rounded-md"
            >
              <LeadSmartLogo className="max-w-[min(100%,280px)] sm:max-w-[min(100%,320px)]" />
            </Link>
            <nav className="hidden flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm lg:gap-x-6 md:flex" aria-label="Page sections">
              <a href="#problem" className="font-medium !text-gray-700 hover:!text-[#0072ce]">
                Problem
              </a>
              <a href="#solution" className="font-medium !text-gray-700 hover:!text-[#0072ce]">
                Solution
              </a>
              <a href="#how" className="font-medium !text-gray-700 hover:!text-[#0072ce]">
                How It Works
              </a>
              <a href="#features" className="font-medium !text-gray-700 hover:!text-[#0072ce]">
                Features
              </a>
              <a href="#pricing" className="font-medium !text-gray-700 hover:!text-[#0072ce]">
                Pricing
              </a>
            </nav>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <SupportChatLauncher buttonClassName="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200/90 bg-white text-gray-600 shadow-sm transition hover:border-[#0072ce]/40 hover:bg-gray-50 hover:text-[#0072ce] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0072ce]/40 sm:h-10 sm:w-10 sm:rounded-xl" />
              <Button size="sm" href={primaryCtaHref} className="whitespace-nowrap">
                Get My First Leads
              </Button>
              <HeaderAuthActions />
            </div>
          </div>
        </header>

        {/* HERO — above the fold */}
        <section className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-slate-50 via-white to-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            aria-hidden
            style={{
              backgroundImage:
                "radial-gradient(ellipse 90% 60% at 50% -30%, rgba(0,114,206,0.18), transparent 55%)",
            }}
          />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 py-14 md:grid-cols-2 md:gap-12 md:py-20 lg:py-24">
          <div className="max-w-xl lg:max-w-2xl">
            <h1 className="font-heading text-4xl font-bold leading-[1.1] tracking-tight text-gray-950 md:text-5xl lg:text-[2.75rem]">
              The AI Deal Engine for Real Estate
            </h1>
            <p className="mt-5 text-xl font-semibold text-gray-900 md:text-2xl md:leading-snug">
              We don&apos;t just generate leads.
            </p>
            <p className="mt-2 text-xl font-semibold leading-snug text-[#0072ce] md:text-2xl">
              We turn them into closed deals — automatically.
            </p>
            <p className="mt-5 text-base leading-relaxed text-gray-600 md:text-lg">
              Capture, qualify, and convert high-intent buyers and sellers with AI — so you can focus on closing, not
              chasing.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href={primaryCtaHref} className="min-h-11 px-6 text-base">
                Get My First Leads
              </Button>
              {hasVsl && (
                <Button variant="outline" href={vslAnchorHref} className="min-h-11 px-6 text-base">
                  Watch 60s Demo
                </Button>
              )}
            </div>

            {/* Micro trust — directly under CTA */}
            <div className="mt-6 rounded-xl border border-slate-200/80 bg-gradient-to-r from-[#0072ce]/[0.06] via-white to-[#ff8c42]/[0.07] pt-6 pl-4 pr-3 pb-4 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.04]">
              <div className="flex items-center gap-2 border-l-4 border-[#0072ce] pl-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#005ca8]">
                  <span aria-hidden>🧠</span> Micro trust
                </p>
              </div>
              <p className="mt-3 pl-1 text-sm font-semibold text-slate-800">
                No setup required{" "}
                <span className="text-[#0072ce]" aria-hidden>
                  •
                </span>{" "}
                Works in minutes
              </p>
              <ul className="mt-3 flex flex-col gap-2.5 text-sm text-slate-700 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
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
          <div className="flex h-72 items-center justify-center rounded-2xl border border-gray-200 bg-gradient-to-br from-slate-100 to-slate-200/80 p-6 shadow-inner md:h-80">
            <div className="w-full max-w-md rounded-xl border border-white/80 bg-white p-4 shadow-lg">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Dashboard preview</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  ["12", "New leads"],
                  ["94%", "Reply rate"],
                  ["8", "Tours booked"],
                ].map(([n, l]) => (
                  <div key={l} className="rounded-lg bg-slate-50 px-2 py-3">
                    <p className="text-xl font-bold text-[#0072ce]">{n}</p>
                    <p className="text-[10px] font-medium text-gray-500">{l}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-[72%] rounded-full bg-[#0072ce]" />
              </div>
              <p className="mt-2 text-center text-[11px] text-gray-400">Pipeline health · live</p>
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

        {/* PROBLEM — emotional + direct */}
        <section
          id="problem"
          className="border-y border-rose-100 bg-gradient-to-b from-rose-50/90 via-white to-slate-50/80 px-6 py-16 text-center md:py-20"
        >
          <div className="mx-auto max-w-2xl">
            <h2 className="font-heading text-2xl font-bold leading-tight text-slate-900 md:text-3xl lg:text-[2rem]">
              You don&apos;t have a traffic problem.
            </h2>
            <p className="mt-4 font-heading text-xl font-bold text-rose-700 md:text-2xl">
              You have a conversion problem.
            </p>
            <ul className="mx-auto mt-8 max-w-md space-y-3 text-left text-base text-slate-700 md:max-w-lg md:text-lg">
              <li className="flex gap-3 border-l-4 border-rose-200 pl-4">
                <span className="font-semibold text-rose-600">→</span>
                <span>Leads don&apos;t respond.</span>
              </li>
              <li className="flex gap-3 border-l-4 border-rose-200 pl-4">
                <span className="font-semibold text-rose-600">→</span>
                <span>Follow-ups are too slow.</span>
              </li>
              <li className="flex gap-3 border-l-4 border-rose-200 pl-4">
                <span className="font-semibold text-rose-600">→</span>
                <span>And high-intent clients choose someone else.</span>
              </li>
            </ul>
            <p className="mt-10 font-heading text-lg font-bold leading-snug text-rose-800 md:text-xl">
              Every missed response is a lost commission.
            </p>
          </div>
        </section>

        {/* SOLUTION — clear shift (problem → fix) */}
        <section
          id="solution"
          className="border-y border-emerald-100 bg-gradient-to-b from-emerald-50/95 via-white to-emerald-50/40 px-6 py-16 md:py-20"
        >
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-heading text-2xl font-bold leading-tight text-slate-900 md:text-3xl lg:text-[2rem]">
              LeadSmart AI fixes the entire pipeline.
            </h2>
            <p className="mt-5 text-lg font-semibold text-slate-800 md:text-xl">
              From first click to final deal —{" "}
              <span className="text-[#0072ce]">handled by AI.</span>
            </p>
            <ul className="mx-auto mt-10 max-w-md space-y-4 text-left text-base font-medium text-slate-800 md:max-w-lg md:text-lg">
              <li className="flex items-start gap-3 rounded-xl border border-emerald-100/80 bg-white/80 px-4 py-3 shadow-sm shadow-emerald-900/5">
                <BrandCheck tone="primary" />
                <span>No more chasing.</span>
              </li>
              <li className="flex items-start gap-3 rounded-xl border border-emerald-100/80 bg-white/80 px-4 py-3 shadow-sm shadow-emerald-900/5">
                <BrandCheck tone="success" />
                <span>No more guessing.</span>
              </li>
              <li className="flex items-start gap-3 rounded-xl border border-emerald-100/80 bg-white/80 px-4 py-3 shadow-sm shadow-emerald-900/5">
                <BrandCheck tone="accent" />
                <span>No more missed opportunities.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="px-6 py-16">
          <div className="mx-auto grid max-w-7xl items-center gap-10 md:grid-cols-2">
            <div>
              <h2 className="font-heading text-2xl font-semibold md:text-3xl">How It Works</h2>
              <ul className="mt-6 space-y-4 text-gray-600">
                {(
                  [
                    { n: 1, label: "Attract traffic", tone: "primary" as const },
                    { n: 2, label: "Capture leads", tone: "primaryDark" as const },
                    { n: 3, label: "AI follows up instantly", tone: "success" as const },
                    { n: 4, label: "You close the deal", tone: "accent" as const },
                  ] as const
                ).map((step) => (
                  <li key={step.n} className="flex gap-3">
                    <BrandCheck tone={step.tone} size="md" />
                    <span className="pt-0.5">
                      <span className="font-semibold text-slate-800">{step.n}.</span> {step.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex min-h-[16rem] items-center justify-center">
              <figure className="w-full max-w-xl lg:max-w-none">
                <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/5">
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
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="bg-slate-50/70 px-6 py-16 md:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-2xl font-semibold md:text-3xl">
                Close More Deals with Less Work
              </h2>
              <p className="mt-3 text-base text-gray-600 md:text-lg">
                Every feature built specifically for real estate agents — not generic sales teams.
              </p>
            </div>
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
              ].map((f) => (
                <div
                  key={f.title}
                  className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"
                >
                  <div className="mb-4 text-3xl">{f.emoji}</div>
                  <h3 className="font-heading text-base font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{f.description}</p>
                  <ul className="mt-4 space-y-1.5">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2 text-xs text-slate-700">
                        <BrandCheck tone={f.accent} />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SOCIAL PROOF */}
        <section className="bg-gradient-to-b from-white to-slate-50 px-6 py-16 md:py-20">
          <div className="mx-auto max-w-6xl text-center">
            <h2 className="font-heading text-2xl font-semibold md:text-3xl">What Agents Are Saying</h2>
            <p className="mt-2 text-sm text-gray-500">Results from early-access agents who replaced their old CRM</p>
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
              ].map((t) => (
                <div
                  key={t.name}
                  className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 text-left shadow-sm"
                >
                  <div className="mb-4">
                    <BrandCheck tone={t.tone} />
                  </div>
                  <blockquote className="flex-1 text-sm leading-relaxed text-slate-700 italic">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <footer className="mt-4 border-t border-slate-100 pt-4">
                    <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </footer>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="px-6 py-16 md:py-20">
          <div className="mx-auto max-w-7xl text-center">
            <h2 className="font-heading text-2xl font-semibold md:text-3xl">Start Closing Deals Today</h2>
            <p className="mt-2 text-gray-600">Simple pricing. No contracts. Cancel anytime.</p>
            <div className="mx-auto mt-10 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {/* Free */}
              <Card>
                <CardContent className="p-5 text-left">
                  <h3 className="font-heading text-base font-semibold">Free</h3>
                  <p className="mt-1 text-2xl font-bold text-slate-900">$0 <span className="text-xs font-normal text-gray-500">/mo</span></p>
                  <p className="mt-2 text-xs text-gray-500">Test the platform and see leads flow in.</p>
                  <ul className="mt-4 space-y-2 text-xs text-slate-700">
                    {["25 leads/month", "Email follow-up only", "Pipeline dashboard", "Basic lead scoring", "1 drip sequence"].map((f) => (
                      <li key={f} className="flex items-center gap-2"><BrandCheck tone="primary" />{f}</li>
                    ))}
                  </ul>
                  <Button className="mt-5 w-full text-xs" variant="outline" href={primaryCtaHref}>Get started free</Button>
                </CardContent>
              </Card>
              {/* Pro */}
              <Card className="relative border-2 border-[#0072ce] ring-2 ring-[#0072ce]/10">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#0072ce] px-3 py-0.5 text-xs font-semibold text-white">Most Popular</div>
                <CardContent className="p-5 text-left">
                  <h3 className="font-heading text-base font-semibold">Pro</h3>
                  <p className="mt-1 text-2xl font-bold text-slate-900">$49 <span className="text-xs font-normal text-gray-500">/mo</span></p>
                  <p className="mt-2 text-xs text-gray-500">Full CRM and AI for active agents.</p>
                  <ul className="mt-4 space-y-2 text-xs text-slate-700">
                    {["500 leads/month", "SMS + email AI follow-up", "Advanced lead scoring", "Unlimited drip sequences", "Tour & offer tracking", "CRM integrations"].map((f) => (
                      <li key={f} className="flex items-center gap-2"><BrandCheck tone="primary" />{f}</li>
                    ))}
                  </ul>
                  <Button className="mt-5 w-full text-xs" href="/pricing">Start free trial</Button>
                  <p className="mt-1.5 text-center text-[11px] text-gray-400">14-day trial · No card needed</p>
                </CardContent>
              </Card>
              {/* Elite */}
              <Card>
                <CardContent className="p-5 text-left">
                  <h3 className="font-heading text-base font-semibold">Elite</h3>
                  <p className="mt-1 text-2xl font-bold text-slate-900">$99 <span className="text-xs font-normal text-gray-500">/mo</span></p>
                  <p className="mt-2 text-xs text-gray-500">For top producers closing 10+ deals/month.</p>
                  <ul className="mt-4 space-y-2 text-xs text-slate-700">
                    {["Unlimited leads", "Priority AI routing", "Multi-channel automation", "Predictive lead scoring", "Custom drip campaigns", "Dedicated onboarding"].map((f) => (
                      <li key={f} className="flex items-center gap-2"><BrandCheck tone="success" />{f}</li>
                    ))}
                  </ul>
                  <Button className="mt-5 w-full text-xs" variant="outline" href="/pricing">Start free trial</Button>
                </CardContent>
              </Card>
              {/* Team */}
              <Card>
                <CardContent className="p-5 text-left">
                  <h3 className="font-heading text-base font-semibold">Team</h3>
                  <p className="mt-1 text-2xl font-bold text-slate-900">$199 <span className="text-xs font-normal text-gray-500">/mo</span></p>
                  <p className="mt-2 text-xs text-gray-500">Multiple agents, one shared pipeline.</p>
                  <ul className="mt-4 space-y-2 text-xs text-slate-700">
                    {["Up to 10 agents", "Shared lead pool & routing", "Team performance dashboard", "Admin controls", "White-label option", "Priority support SLA"].map((f) => (
                      <li key={f} className="flex items-center gap-2"><BrandCheck tone="accent" />{f}</li>
                    ))}
                  </ul>
                  <Button className="mt-5 w-full text-xs" variant="outline" href="/contact">Contact sales</Button>
                </CardContent>
              </Card>
            </div>
            <p className="mt-6 text-sm text-gray-500">
              See the full feature comparison →{" "}
              <a href="/pricing" className="font-semibold text-[#0072ce] hover:underline">View all plans</a>
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-slate-50 px-6 py-16 md:py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center font-heading text-2xl font-semibold md:text-3xl">Common Questions</h2>
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
                <div key={i} className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
                  <h3 className="font-heading text-base font-semibold text-slate-900">{item.q}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="bg-gray-900 py-20 text-center text-white">
          <h2 className="font-heading text-3xl font-semibold">Stop Losing Deals</h2>
          <p className="mt-4 text-gray-300">Start converting leads automatically</p>
          <Button className="mt-6" variant="secondary" href={primaryCtaHref}>
            Get My First Leads
          </Button>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-200 bg-white px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
              <LeadSmartLogo compact className="max-w-[220px] opacity-90" priority={false} />
              <p className="text-sm font-semibold text-gray-800">© {new Date().getFullYear()} LeadSmart AI</p>
            </div>
            <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
              <Link href="/contact" className="!text-gray-600 hover:!text-[#0072ce]">
                Contact
              </Link>
              <Link href="/privacy" className="!text-gray-600 hover:!text-[#0072ce]">
                Privacy
              </Link>
              <Link href="/terms" className="!text-gray-600 hover:!text-[#0072ce]">
                Terms
              </Link>
              <Link href="/pricing" className="!text-gray-600 hover:!text-[#0072ce]">
                Pricing
              </Link>
            </nav>
          </div>
        </footer>
      </main>

      <ExitIntentPopup role="agent" />
    </>
  );
}
