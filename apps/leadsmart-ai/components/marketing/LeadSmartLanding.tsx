"use client";

import Image from "next/image";
import Link from "next/link";
import { LeadSmartLogo } from "@/components/brand/LeadSmartLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ExitIntentPopup from "@/components/marketing/ExitIntentPopup";

const primaryCtaHref = "/onboarding";
const demoCtaHref = "/home-value-funnel";

export default function LeadSmartLanding() {
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
            <Button size="sm" href={primaryCtaHref}>
              Get My First Leads
            </Button>
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
              <Button variant="outline" href={demoCtaHref} className="min-h-11 px-6 text-base">
                Watch 60s Demo
              </Button>
            </div>

            {/* Micro trust — directly under CTA */}
            <div className="mt-6 border-t border-slate-200/90 pt-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">
                <span aria-hidden>🧠</span> Micro trust
              </p>
              <p className="mt-2 text-sm font-semibold text-gray-700">No setup required • Works in minutes</p>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-gray-600 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-600" aria-hidden>
                    ✓
                  </span>
                  AI follow-up in seconds — so hot leads don&apos;t go cold
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-600" aria-hidden>
                    ✓
                  </span>
                  Built for agents already running ads &amp; SEO
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-600" aria-hidden>
                    ✓
                  </span>
                  Cancel anytime — no multi-year lock-in
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
                <span className="mt-0.5 text-emerald-600" aria-hidden>
                  ✓
                </span>
                <span>No more chasing.</span>
              </li>
              <li className="flex items-start gap-3 rounded-xl border border-emerald-100/80 bg-white/80 px-4 py-3 shadow-sm shadow-emerald-900/5">
                <span className="mt-0.5 text-emerald-600" aria-hidden>
                  ✓
                </span>
                <span>No more guessing.</span>
              </li>
              <li className="flex items-start gap-3 rounded-xl border border-emerald-100/80 bg-white/80 px-4 py-3 shadow-sm shadow-emerald-900/5">
                <span className="mt-0.5 text-emerald-600" aria-hidden>
                  ✓
                </span>
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
                <li className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0072ce] text-sm font-bold !text-white">
                    1
                  </span>
                  <span>Attract traffic</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0072ce] text-sm font-bold !text-white">
                    2
                  </span>
                  <span>Capture leads</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0072ce] text-sm font-bold !text-white">
                    3
                  </span>
                  <span>AI follows up instantly</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0072ce] text-sm font-bold !text-white">
                    4
                  </span>
                  <span>You close the deal</span>
                </li>
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
        <section id="features" className="mx-auto max-w-7xl px-6 py-16">
          <h2 className="text-center font-heading text-2xl font-semibold md:text-3xl">
            Close More Deals with Less Work
          </h2>
          <div className="mt-10 grid gap-8 text-center sm:grid-cols-2 md:grid-cols-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-6">
              <p className="font-semibold">⚡ Instant Follow-Up</p>
              <p className="mt-2 text-sm text-gray-600">Respond in seconds</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-6">
              <p className="font-semibold">🧠 AI Scoring</p>
              <p className="mt-2 text-sm text-gray-600">Prioritize hot leads</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-6">
              <p className="font-semibold">📊 Dashboard</p>
              <p className="mt-2 text-sm text-gray-600">Track everything</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-6">
              <p className="font-semibold">🔄 Automation</p>
              <p className="mt-2 text-sm text-gray-600">Follow-up done for you</p>
            </div>
          </div>
        </section>

        {/* SOCIAL PROOF */}
        <section className="bg-gray-50 px-6 py-16 text-center">
          <h2 className="font-heading text-2xl font-semibold md:text-3xl">Real Results</h2>
          <div className="mx-auto mt-8 max-w-xl space-y-4 text-gray-600">
            <p className="italic">&ldquo;Got 12 qualified leads in 7 days&rdquo;</p>
            <p className="italic">&ldquo;Response rate doubled overnight&rdquo;</p>
            <p className="italic">&ldquo;Finally leads that convert&rdquo;</p>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="mx-auto max-w-7xl px-6 py-16 text-center">
          <h2 className="font-heading text-2xl font-semibold md:text-3xl">Start Closing Deals Today</h2>
          <p className="mt-2 text-gray-600">Simple pricing. No risk.</p>
          <div className="mx-auto mt-10 grid max-w-3xl gap-6 md:grid-cols-2">
            <Card>
              <CardContent className="p-6 text-left">
                <h3 className="font-heading text-lg font-semibold">Starter</h3>
                <p className="mt-2 text-sm text-gray-600">Free</p>
                <p className="mt-4 text-sm text-gray-500">Try core workflows and see leads in your pipeline.</p>
                <Button className="mt-6 w-full" variant="outline" href={primaryCtaHref}>
                  Get started
                </Button>
              </CardContent>
            </Card>
            <Card className="border-2 border-gray-900 ring-2 ring-gray-900/10">
              <CardContent className="p-6 text-left">
                <h3 className="font-heading text-lg font-semibold">Pro</h3>
                <p className="mt-2 text-sm text-gray-600">$29/month</p>
                <p className="mt-4 text-sm text-gray-500">Full CRM, automation, and scale for active agents.</p>
                <Button className="mt-6 w-full" href="/pricing">
                  View plans
                </Button>
              </CardContent>
            </Card>
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
