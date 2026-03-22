"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ExitIntentPopup from "@/components/marketing/ExitIntentPopup";
import HowItWorksFunnelDiagram from "@/components/marketing/HowItWorksFunnelDiagram";

const primaryCtaHref = "/onboarding";

export default function LeadSmartLanding() {
  return (
    <>
      <main className="bg-white text-gray-900">
        {/* NAV */}
        <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 font-heading text-lg font-bold !text-gray-900 transition hover:opacity-90"
            >
              <Image
                src="/images/lslogo.png"
                alt="LeadSmart AI"
                width={160}
                height={48}
                className="h-9 w-auto sm:h-10"
                priority
              />
            </Link>
            <nav className="hidden gap-6 text-sm md:flex">
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

        {/* HERO */}
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-12 md:grid-cols-2">
          <div>
            <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight">
              Turn Online Traffic into Closed Deals — Automatically
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              Capture, qualify, and convert high-intent real estate leads with AI.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button href={primaryCtaHref}>Get My First Leads</Button>
              <Button variant="outline" href="#how">
                See How It Works
              </Button>
            </div>
            <p className="mt-3 text-sm text-gray-500">No setup required • Works in minutes</p>
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
        </section>

        {/* PROBLEM */}
        <section className="bg-gray-50 px-6 py-16 text-center">
          <h2 className="font-heading text-2xl font-semibold md:text-3xl">You Don’t Have a Traffic Problem</h2>
          <p className="mx-auto mt-6 max-w-2xl text-gray-600">
            You’re losing deals because leads don’t respond, follow-ups are too slow, and high-intent buyers slip away.
          </p>
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
            <div className="min-h-[16rem]">
              <HowItWorksFunnelDiagram
                stages={["Attract", "Capture", "Nurture"]}
                hints={["SEO, ads, tools", "Forms & SMS", "AI + you"]}
                outcome="You close"
              />
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
              <Image
                src="/images/lslogo.png"
                alt=""
                width={140}
                height={40}
                className="h-8 w-auto opacity-90"
              />
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
