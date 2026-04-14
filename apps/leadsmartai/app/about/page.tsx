"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import JsonLd from "@/components/JsonLd";

export default function AboutLeadSmartAIPage() {
  return (
    <main className="bg-white text-slate-900">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "LeadSmart AI",
          description:
            "LeadSmart AI helps real estate agents and financing professionals capture, qualify, and convert leads with AI — so they can spend less time chasing and more time closing. The AI growth engine for real estate professionals.",
          url: "https://leadsmart-ai.com",
          logo: "https://leadsmart-ai.com/logo.png",
          sameAs: [
            "https://twitter.com/leadsmart-ai",
            "https://linkedin.com/company/leadsmart-ai",
          ],
          contactPoint: {
            "@type": "ContactPoint",
            url: "https://leadsmart-ai.com/contact",
            contactType: "Customer Service",
          },
        }}
      />
      {/* Hero */}
      <section className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-7xl px-6 py-20 md:py-24">
          <div className="max-w-4xl">
            <p className="mb-4 inline-flex rounded-full border border-slate-200/90 bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.15em] text-slate-600 shadow-sm ring-1 ring-slate-900/[0.03]">
              About LeadSmart AI
            </p>

            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              The AI Growth Engine for Real Estate Professionals
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 md:text-xl">
              LeadSmart AI helps real estate agents and financing professionals capture, qualify, and convert leads with AI — so they
              can spend less time chasing and more time closing.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button href="/signup">Get Started</Button>
              <Button href="/contact" variant="outline">
                See Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="mx-auto max-w-7xl px-6 py-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-2 md:items-start">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">We don’t just generate leads.</h2>
            <p className="mt-3 text-2xl font-semibold text-slate-900 md:text-3xl">We turn them into closed deals.</p>
          </div>

          <div className="space-y-6 text-base leading-8 text-slate-600">
            <p>
              In today’s market, getting traffic is no longer the hardest part. The real challenge is converting that traffic into real
              conversations, qualified opportunities, and closed transactions.
            </p>
            <p>
              LeadSmart AI was built to solve that problem. We combine intelligent automation, behavioral insights, and AI-powered
              follow-up into one system designed specifically for real estate.
            </p>
            <p>
              Instead of simply storing contacts in a CRM, LeadSmart AI helps agents respond faster, prioritize smarter, and move every
              lead closer to a deal.
            </p>
          </div>
        </div>
      </section>

      {/* Value Cards */}
      <section className="bg-slate-50/80">
        <div className="mx-auto max-w-7xl px-6 py-16 md:py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight">What makes us different</h2>
            <p className="mt-4 text-slate-600">
              Traditional tools help you manage contacts. LeadSmart AI helps you create outcomes.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.03]">
              <CardContent className="p-6">
                <p className="text-sm font-medium uppercase tracking-widest text-slate-500">AI Qualification</p>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">Prioritize serious leads</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Identify high-intent buyers and sellers faster, so your time goes where it matters most.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.03]">
              <CardContent className="p-6">
                <p className="text-sm font-medium uppercase tracking-widest text-slate-500">Instant Follow-Up</p>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">Respond in seconds</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  AI-powered responses help you engage leads immediately, before they move on to someone else.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.03]">
              <CardContent className="p-6">
                <p className="text-sm font-medium uppercase tracking-widest text-slate-500">Workflow Automation</p>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">Reduce manual work</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Automate repetitive tasks and follow-up sequences without sacrificing the personal touch.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.03]">
              <CardContent className="p-6">
                <p className="text-sm font-medium uppercase tracking-widest text-slate-500">Deal Visibility</p>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">Track the full pipeline</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  From first click to closed deal, see exactly where every lead stands and what to do next.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Problem / Solution */}
      <section className="mx-auto max-w-7xl px-6 py-16 md:py-20">
        <div className="grid gap-10 md:grid-cols-2">
          <div className="rounded-3xl border border-rose-100/90 bg-gradient-to-br from-rose-50 to-white p-8 shadow-sm ring-1 ring-rose-900/[0.04]">
            <p className="text-sm font-medium uppercase tracking-widest text-rose-700">The problem</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">Real estate teams are losing deals in the gaps.</h2>
            <ul className="mt-6 space-y-4 text-slate-700">
              <li className="flex gap-2">
                <span className="text-rose-500" aria-hidden>
                  •
                </span>
                <span>Leads go cold because follow-up is too slow</span>
              </li>
              <li className="flex gap-2">
                <span className="text-rose-500" aria-hidden>
                  •
                </span>
                <span>Agents waste time on low-quality prospects</span>
              </li>
              <li className="flex gap-2">
                <span className="text-rose-500" aria-hidden>
                  •
                </span>
                <span>Important opportunities slip through manual workflows</span>
              </li>
              <li className="flex gap-2">
                <span className="text-rose-500" aria-hidden>
                  •
                </span>
                <span>Most CRMs record activity, but don’t drive conversion</span>
              </li>
            </ul>
          </div>

          <div className="rounded-3xl border border-emerald-100/90 bg-gradient-to-br from-emerald-50 to-white p-8 shadow-sm ring-1 ring-emerald-900/[0.04]">
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">The solution</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">LeadSmart AI closes the gaps with intelligent automation.</h2>
            <ul className="mt-6 space-y-4 text-slate-700">
              <li className="flex gap-2">
                <span className="text-emerald-600" aria-hidden>
                  •
                </span>
                <span>Capture high-intent leads from inbound traffic</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-600" aria-hidden>
                  •
                </span>
                <span>Score and qualify opportunities automatically</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-600" aria-hidden>
                  •
                </span>
                <span>Trigger fast, personalized AI follow-up</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-600" aria-hidden>
                  •
                </span>
                <span>Surface the right next action at the right time</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-7xl px-6 py-16 md:py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-widest text-slate-400">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">A connected system from first click to closed deal</h2>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {["Traffic", "Lead Capture", "AI Qualification", "AI Follow-Up", "Agent Dashboard", "Closed Deal"].map((step, index) => (
              <div
                key={step}
                className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-lg shadow-black/10 backdrop-blur-sm"
              >
                <p className="text-sm tabular-nums text-slate-400">0{index + 1}</p>
                <p className="mt-3 font-medium">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audience */}
      <section className="mx-auto max-w-7xl px-6 py-16 md:py-20">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Built for modern real estate teams</h2>
            <p className="mt-4 max-w-2xl text-slate-600">
              LeadSmart AI is designed for professionals who need speed, visibility, and a more reliable way to convert opportunities
              into revenue.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              "Real estate agents",
              "Mortgage brokers",
              "Teams & brokerages",
              "Loan officers & lenders",
              "Inside sales & ISA teams",
              "High-volume solo producers",
            ].map((label) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/50 px-4 py-3 text-sm font-medium text-slate-800 ring-1 ring-slate-900/[0.03]"
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-7xl px-6 py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Ready to turn more leads into closings?</h2>
            <p className="mt-4 text-lg text-slate-600">
              Join professionals who use LeadSmart AI to respond faster, qualify smarter, and keep every deal moving.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button href="/signup">Get Started</Button>
              <Button href="/pricing" variant="outline">
                View pricing
              </Button>
            </div>
            <p className="mt-8">
              <Link href="/" className="text-sm font-medium text-[#0072ce] hover:text-[#005ca8]">
                ← Back to home
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
