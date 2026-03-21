"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const nav = [
  { href: "#problem", label: "Problem" },
  { href: "#solution", label: "Solution" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#product", label: "Product" },
  { href: "#proof", label: "Results" },
  { href: "#pricing", label: "Pricing" },
];

const problemPoints = [
  {
    title: "Leads go cold in the inbox",
    body: "Homeowners submit a form—and you’re too busy showing homes to follow up the same day.",
  },
  {
    title: "Tools don’t talk to each other",
    body: "CMA here, CRM there, texts somewhere else. Nothing tells you who’s ready to list.",
  },
  {
    title: "Pipeline visibility is a guess",
    body: "You don’t know which sellers are heating up until it’s too late.",
  },
];

const solutionPillars = [
  {
    title: "Capture & qualify 24/7",
    body: "AI-assisted home value funnels turn curiosity into conversations—even while you sleep.",
  },
  {
    title: "One place for every lead",
    body: "CRM built for agents: stages, tasks, notes, and history in one timeline.",
  },
  {
    title: "Nudges that feel human",
    body: "Email & SMS sequences you can customize so follow-up stays personal at scale.",
  },
];

const steps = [
  {
    n: "01",
    title: "Launch your funnel",
    body: "Share your LeadSmart link or embed home value tools on your site and socials.",
  },
  {
    n: "02",
    title: "Leads sync automatically",
    body: "Every submission lands in your CRM with source, property context, and next steps.",
  },
  {
    n: "03",
    title: "Convert with confidence",
    body: "Use AI CMAs, alerts, and playbooks to book listing appointments faster.",
  },
];

const showcase = [
  { title: "AI CMA & reports", desc: "Professional comps and narratives sellers actually read." },
  { title: "Lead routing & CRM", desc: "Pipeline stages, reminders, and team-ready workflows." },
  { title: "SMS & nurture", desc: "Templates and automations that stay compliant and on-brand." },
  { title: "Open house & events", desc: "QR signups that flow straight into follow-up sequences." },
  { title: "Growth analytics", desc: "See what channels and campaigns drive real conversations." },
  { title: "Agent dashboard", desc: "One command center for today’s hottest opportunities." },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "/mo",
    blurb: "Try core flows",
    features: ["Limited CMA/day", "Basic alerts", "Explore the CRM"],
    cta: "Get started",
    href: "/signup",
    highlight: false,
  },
  {
    name: "Pro Agent",
    price: "$49",
    period: "/mo",
    blurb: "For active producers",
    features: ["Higher CMA limits", "Full CRM & leads", "Engagement tracking"],
    cta: "Start Pro",
    href: "/pricing",
    highlight: true,
  },
  {
    name: "Premium",
    price: "$99",
    period: "/mo",
    blurb: "Teams & power users",
    features: ["Expanded limits", "Automation", "Team access"],
    cta: "View Premium",
    href: "/pricing",
    highlight: false,
  },
];

export default function LeadSmartLanding() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Image
              src="/images/lslogo.png"
              alt="LeadSmart AI"
              width={160}
              height={48}
              className="h-10 w-auto sm:h-11"
              priority
            />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 sm:inline-flex"
            >
              Log in
            </Link>
            <Link
              href="/agent-signup"
              className="inline-flex items-center justify-center rounded-xl bg-[#0072ce] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#005ca8]"
            >
              Start free
            </Link>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open menu"
              onClick={() => setOpen((v) => !v)}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {open ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {open ? (
          <div className="border-t border-slate-100 bg-white px-4 py-4 lg:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-1">
              {nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <Link
                href="/login"
                className="mt-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-800"
                onClick={() => setOpen(false)}
              >
                Log in
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      <main>
        {/* Hero */}
        <section id="hero" className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,114,206,0.35),transparent)]" />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
            <p className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-200/90">
              Built for listing agents
            </p>
            <h1 className="font-heading max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Turn clicks into signed listings—before your competitor does.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              LeadSmart AI combines AI home-value funnels, automated follow-up, and an agent-first CRM so
              you capture more seller leads and book more listing appointments—without living in spreadsheets.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/agent-signup"
                className="inline-flex items-center justify-center rounded-xl bg-[#0072ce] px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-900/30 transition hover:bg-[#005ca8]"
              >
                Start free as an agent
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-base font-semibold text-white backdrop-blur transition hover:bg-white/10"
              >
                View pricing
              </Link>
              <Link
                href="/home-value-funnel"
                className="text-center text-sm font-medium text-sky-200/90 underline-offset-4 hover:underline sm:ml-2"
              >
                Try the home value funnel →
              </Link>
            </div>
            <p className="mt-8 text-sm text-slate-400">
              No credit card to explore · Setup in minutes · Works alongside your existing site
            </p>
          </div>
        </section>

        {/* Problem */}
        <section id="problem" className="scroll-mt-24 border-b border-slate-100 bg-slate-50 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                The old way is leaking listings
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Buyers get attention. Sellers need speed, proof, and persistence—most agent stacks weren’t
                built for that.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {problemPoints.map((p) => (
                <div
                  key={p.title}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
                >
                  <h3 className="font-heading text-lg font-semibold text-slate-900">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Solution */}
        <section id="solution" className="scroll-mt-24 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                One system for capture, nurture, and close
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                LeadSmart AI is the operating layer for modern listing agents—so every lead gets a next
                step, automatically.
              </p>
            </div>
            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {solutionPillars.map((s) => (
                <div key={s.title} className="text-center md:text-left">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-lg font-bold text-[#0072ce] md:mx-0">
                    ✓
                  </div>
                  <h3 className="font-heading text-xl font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-24 border-y border-slate-100 bg-slate-50 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="font-heading text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              How it works
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-slate-600">
              Three steps from link to listing conversation.
            </p>
            <ol className="mt-14 grid gap-10 md:grid-cols-3">
              {steps.map((s) => (
                <li key={s.n} className="relative">
                  <span className="font-heading text-5xl font-extrabold text-slate-200">{s.n}</span>
                  <h3 className="font-heading -mt-2 text-xl font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Product showcase */}
        <section id="product" className="scroll-mt-24 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Everything you need to run seller growth
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Purpose-built modules agents use every week—not generic “all-in-one” bloat.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {showcase.map((f) => (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/80 p-5 shadow-sm transition hover:border-[#0072ce]/30 hover:shadow-md"
                >
                  <h3 className="font-heading font-semibold text-slate-900 group-hover:text-[#005ca8]">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">{f.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 flex justify-center">
              <Link
                href="/dashboard"
                className="text-sm font-semibold text-[#0072ce] hover:underline"
              >
                Already an agent? Go to dashboard →
              </Link>
            </div>
          </div>
        </section>

        {/* Social proof */}
        <section id="proof" className="scroll-mt-24 border-y border-slate-100 bg-slate-950 py-16 text-white sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
                  Built for agents who measure pipeline in conversations
                </h2>
                <p className="mt-4 text-slate-300">
                  Teams use LeadSmart AI to centralize seller intent, tighten follow-up SLAs, and show
                  sellers a polished, data-backed story—fast.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:gap-6">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="font-heading text-xl font-bold text-sky-300">Same-day</div>
                  <p className="mt-1 text-sm text-slate-400">Structured first-touch vs. inbox chaos</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="font-heading text-3xl font-bold text-sky-300">24/7</div>
                  <p className="mt-1 text-sm text-slate-400">Capture on your funnels</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:col-span-2">
                  <blockquote className="text-sm leading-relaxed text-slate-200">
                    “We finally see which homeowners are engaging before the appointment—instead of guessing
                    from scattered texts.”
                  </blockquote>
                  <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                    — Agent team feedback (anonymized)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing preview */}
        <section id="pricing" className="scroll-mt-24 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Simple pricing that scales with your production
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Start free. Upgrade when you’re ready to run more CMAs, leads, and automations.
              </p>
            </div>
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {plans.map((p) => (
                <div
                  key={p.name}
                  className={`flex flex-col rounded-2xl border p-6 shadow-sm ${
                    p.highlight
                      ? "border-[#0072ce] bg-sky-50/50 ring-2 ring-[#0072ce]/20"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  {p.highlight ? (
                    <span className="mb-3 inline-flex w-fit rounded-full bg-[#0072ce] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Most popular
                    </span>
                  ) : (
                    <span className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {p.blurb}
                    </span>
                  )}
                  <h3 className="font-heading text-lg font-semibold text-slate-900">{p.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-slate-900">{p.price}</span>
                    <span className="text-slate-500">{p.period}</span>
                  </div>
                  <ul className="mt-6 flex-1 space-y-2 text-sm text-slate-600">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="text-emerald-500">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={p.href}
                    className={`mt-8 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition ${
                      p.highlight
                        ? "bg-[#0072ce] text-white hover:bg-[#005ca8]"
                        : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    {p.cta}
                  </Link>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-slate-500">
              Usage limits and trials may apply. See full details on{" "}
              <Link href="/pricing" className="font-semibold text-[#0072ce] hover:underline">
                the pricing page
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section id="cta" className="scroll-mt-24 bg-gradient-to-r from-[#0072ce] to-[#005ca8] py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="font-heading text-3xl font-bold text-white sm:text-4xl">
              Ready to fill your calendar with listing conversations?
            </h2>
            <p className="mt-4 text-lg text-sky-100">
              Join agents using LeadSmart AI to turn seller intent into pipeline you can actually work.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/agent-signup"
                className="inline-flex w-full items-center justify-center rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-[#005ca8] shadow-lg transition hover:bg-slate-100 sm:w-auto"
              >
                Create your free agent account
              </Link>
              <Link
                href="/signup"
                className="inline-flex w-full items-center justify-center rounded-xl border border-white/40 bg-transparent px-8 py-3.5 text-base font-semibold text-white transition hover:bg-white/10 sm:w-auto"
              >
                Sign up as a user
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-1">
              <Image
                src="/images/lslogo.png"
                alt="LeadSmart AI"
                width={140}
                height={40}
                className="h-9 w-auto opacity-90"
              />
              <p className="mt-3 text-sm text-slate-600">
                AI-powered funnels and CRM for real estate agents who sell listings, not software.
              </p>
            </div>
            <div>
              <h3 className="font-heading text-xs font-semibold uppercase tracking-wide text-slate-500">
                Product
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href="/pricing" className="text-slate-700 hover:text-[#0072ce]">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/home-value-funnel" className="text-slate-700 hover:text-[#0072ce]">
                    Home value funnel
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard" className="text-slate-700 hover:text-[#0072ce]">
                    Dashboard
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-heading text-xs font-semibold uppercase tracking-wide text-slate-500">
                Agents
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href="/agent-signup" className="text-slate-700 hover:text-[#0072ce]">
                    Agent signup
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-slate-700 hover:text-[#0072ce]">
                    Log in
                  </Link>
                </li>
                <li>
                  <Link href="/signup" className="text-slate-700 hover:text-[#0072ce]">
                    User signup
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-heading text-xs font-semibold uppercase tracking-wide text-slate-500">
                Legal
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href="/terms" className="text-slate-700 hover:text-[#0072ce]">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-slate-700 hover:text-[#0072ce]">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-slate-200 pt-8 text-center text-xs text-slate-500">
            © {new Date().getFullYear()} LeadSmart AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
