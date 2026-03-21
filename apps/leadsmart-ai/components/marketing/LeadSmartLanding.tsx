"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getLandingCopy, ROLE_STORAGE_KEY, type UserRole } from "@/components/marketing/landingCopy";
import { LandingButton, LandingCard, LandingSectionLabel } from "@/components/marketing/LandingPrimitives";
import { trackLandingEvent } from "@/lib/marketing/landingTrack";

const nav = [
  { href: "#problem", label: "Problem" },
  { href: "#solution", label: "Solution" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#product", label: "Product" },
  { href: "#proof", label: "Results" },
  { href: "#pricing", label: "Pricing" },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "/mo",
    blurb: "Prove the funnel",
    features: ["Core capture flows", "Starter CRM", "Explore automations"],
    cta: "Get Started Free",
    href: "/agent-signup",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$49",
    period: "/mo",
    blurb: "For active producers",
    features: ["Higher limits", "Full CRM & scoring", "Engagement analytics"],
    cta: "Upgrade to Pro",
    href: "/pricing",
    highlight: true,
  },
  {
    name: "Premium",
    price: "$99",
    period: "/mo",
    blurb: "Teams & scale",
    features: ["Expanded automation", "Team seats", "Priority support"],
    cta: "View Premium",
    href: "/pricing",
    highlight: false,
  },
];

function RoleToggle({ role, onChange }: { role: UserRole; onChange: (r: UserRole) => void }) {
  return (
    <div
      className="inline-flex rounded-2xl border border-slate-200 bg-slate-100/80 p-1 shadow-inner"
      role="group"
      aria-label="Choose audience"
    >
      <button
        type="button"
        onClick={() => onChange("agent")}
        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition sm:px-4 sm:text-sm ${
          role === "agent" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
        }`}
      >
        Agent
      </button>
      <button
        type="button"
        onClick={() => onChange("broker")}
        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition sm:px-4 sm:text-sm ${
          role === "broker" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
        }`}
      >
        Loan broker
      </button>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="landing-hero-float relative mx-auto w-full max-w-xl lg:mx-0">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4 shadow-2xl shadow-black/40 backdrop-blur-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Live pipeline</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-white/10 bg-slate-950/40 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-sky-300/90">Funnel</p>
            {["Traffic", "Qualified", "Booked"].map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className="h-8 flex-1 rounded-lg bg-gradient-to-r from-sky-500/80 to-[#0072ce]/90"
                  style={{ width: `${100 - i * 22}%`, minWidth: "3rem" }}
                />
                <span className="w-14 text-right text-[10px] font-medium text-slate-400">{label}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-slate-950/40 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-300/90">This week</p>
            <div className="mt-2 flex h-24 items-end gap-1.5">
              {[40, 65, 45, 80, 55, 90, 70].map((h, idx) => (
                <div
                  key={idx}
                  className="flex-1 rounded-t bg-gradient-to-t from-[#0072ce] to-sky-400/90 opacity-90"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <p className="mt-2 text-[10px] text-slate-500">Replies · nurture · appointments</p>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute -right-6 -top-6 hidden h-24 w-24 rounded-full bg-sky-500/20 blur-2xl sm:block" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 hidden h-28 w-28 rounded-full bg-[#0072ce]/25 blur-2xl sm:block" />
    </div>
  );
}

export default function LeadSmartLanding() {
  const [role, setRole] = useState<UserRole>("agent");
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const copy = getLandingCopy(role);

  const signupHref = role === "broker" ? "/agent-signup?from=broker" : "/agent-signup";
  const demoHref = "/home-value-funnel";

  useEffect(() => {
    let initial: UserRole = "agent";
    try {
      const saved = localStorage.getItem(ROLE_STORAGE_KEY);
      if (saved === "broker" || saved === "agent") initial = saved;
      setRole(initial);
      trackLandingEvent("landing_view", { role: initial });
    } catch {
      trackLandingEvent("landing_view", { role: "agent" });
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, role);
    } catch {
      /* ignore */
    }
  }, [role, hydrated]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onCta = useCallback((label: string, href: string) => {
    trackLandingEvent("landing_cta_click", { label, href, role });
  }, [role]);

  const onNav = useCallback(
    (label: string, href: string) => {
      trackLandingEvent("landing_nav_click", { label, href, role });
    },
    [role]
  );

  const setRoleTracked = useCallback((r: UserRole) => {
    setRole(r);
    trackLandingEvent("landing_role_change", { role: r });
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Sticky marketing header */}
      <header
        className={`sticky top-0 z-50 border-b transition-[box-shadow,background-color] duration-200 ${
          scrolled ? "border-slate-200/90 bg-white/95 shadow-md shadow-slate-900/5 backdrop-blur-md" : "border-slate-200/60 bg-white/90 backdrop-blur-md"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5">
            <Link href="/" className="flex shrink-0 items-center gap-2" onClick={() => onNav("logo", "/")}>
              <Image
                src="/images/lslogo.png"
                alt="LeadSmart AI"
                width={160}
                height={48}
                className="h-9 w-auto sm:h-10"
                priority
              />
            </Link>
            <div className="hidden sm:block">
              <RoleToggle role={role} onChange={setRoleTracked} />
            </div>
          </div>

          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => onNav(item.label, item.href)}
                className="rounded-xl px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <LandingButton
              href={signupHref}
              variant="primary"
              className="hidden px-4 py-2.5 text-sm shadow-lg shadow-blue-900/20 sm:inline-flex"
              onClick={() => onCta("header_get_started", signupHref)}
            >
              Get Started Free
            </LandingButton>
            <Link
              href="/login"
              className="hidden rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 lg:inline-flex"
              onClick={() => onCta("header_login", "/login")}
            >
              Log in
            </Link>
            <button
              type="button"
              className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
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

        <div className="border-t border-slate-100 px-4 py-3 sm:hidden sm:px-6">
          <RoleToggle role={role} onChange={setRoleTracked} />
        </div>

        {open ? (
          <div className="border-t border-slate-100 bg-white px-4 py-4 lg:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-1">
              {nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setOpen(false);
                    onNav(item.label, item.href);
                  }}
                >
                  {item.label}
                </a>
              ))}
              <LandingButton
                href={signupHref}
                variant="primary"
                className="mt-2 w-full justify-center"
                onClick={() => {
                  setOpen(false);
                  onCta("mobile_get_started", signupHref);
                }}
              >
                Get Started Free
              </LandingButton>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2.5 text-center text-sm font-semibold text-slate-800"
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
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-30%,rgba(0,114,206,0.4),transparent)]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-22 lg:grid-cols-2 lg:gap-16 lg:py-28">
            <div className="landing-animate">
              <p className="mb-4 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-200/95">
                {copy.hero.eyebrow}
              </p>
              <h1 className="font-heading text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[2.75rem] xl:text-6xl">
                {copy.hero.headline}
              </h1>
              <p className="landing-animate landing-delay-1 mt-5 max-w-xl text-lg leading-relaxed text-slate-300 sm:text-xl">
                {copy.hero.subhead}
              </p>
              <p className="landing-animate landing-delay-2 mt-4 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
                {copy.hero.supporting}
              </p>
              <div className="landing-animate landing-delay-3 mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <LandingButton
                  href={signupHref}
                  variant="ghost"
                  className="border-white/25 bg-[#0072ce] px-7 py-3.5 text-base shadow-lg shadow-blue-950/40 hover:bg-[#005ca8]"
                  onClick={() => onCta("hero_primary", signupHref)}
                >
                  {copy.hero.primaryCta}
                </LandingButton>
                <LandingButton
                  href={demoHref}
                  variant="ghost"
                  className="border-white/30 bg-white/5 px-7 py-3.5 text-base hover:bg-white/10"
                  onClick={() => {
                    trackLandingEvent("landing_demo_click", { href: demoHref, role });
                    onCta("hero_demo", demoHref);
                  }}
                >
                  {copy.hero.secondaryCta}
                </LandingButton>
                <Link
                  href="#product"
                  className="text-center text-sm font-semibold text-sky-200/90 underline-offset-4 hover:underline sm:ml-1"
                  onClick={() => onNav("hero_product_anchor", "#product")}
                >
                  Explore product →
                </Link>
              </div>
              <p className="landing-animate landing-delay-4 mt-8 text-sm text-slate-500">{copy.hero.trustLine}</p>
            </div>
            <div className="landing-animate landing-delay-2 justify-self-center lg:justify-self-end">
              <HeroVisual />
            </div>
          </div>
        </section>

        {/* Problem */}
        <section id="problem" className="scroll-mt-24 border-b border-slate-100 bg-slate-50 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <LandingSectionLabel>Problem</LandingSectionLabel>
            <div className="max-w-2xl">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{copy.problem.title}</h2>
              <p className="mt-4 text-lg text-slate-600">{copy.problem.subtitle}</p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {copy.problem.points.map((p) => (
                <LandingCard key={p.title}>
                  <h3 className="font-heading text-lg font-semibold text-slate-900">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.body}</p>
                </LandingCard>
              ))}
            </div>
            <div className="mt-10 flex justify-center">
              <LandingButton href={signupHref} variant="primary" onClick={() => onCta("problem_cta", signupHref)}>
                Fix my follow-up →
              </LandingButton>
            </div>
          </div>
        </section>

        {/* Solution */}
        <section id="solution" className="scroll-mt-24 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <LandingSectionLabel>Solution</LandingSectionLabel>
              <h2 className="font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{copy.solution.title}</h2>
              <p className="mt-4 text-lg text-slate-600">{copy.solution.subtitle}</p>
            </div>
            <ul className="mt-14 grid gap-6 sm:grid-cols-2">
              {copy.solution.bullets.map((s) => (
                <LandingCard key={s.title}>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sm font-bold text-[#0072ce]">
                    ✓
                  </div>
                  <h3 className="font-heading text-lg font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
                </LandingCard>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-24 border-y border-slate-100 bg-slate-50 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <LandingSectionLabel>How it works</LandingSectionLabel>
              <h2 className="font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Attract → Capture → Close</h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">Three steps. One system. Zero busywork.</p>
            </div>
            <ol className="mt-14 grid gap-10 md:grid-cols-3">
              {copy.steps.map((s, idx) => (
                <li key={s.phase} className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <span className="font-heading text-xs font-bold uppercase tracking-widest text-[#0072ce]">{s.phase}</span>
                  <div className="mt-2 font-heading text-4xl font-extrabold text-slate-200">{String(idx + 1).padStart(2, "0")}</div>
                  <h3 className="font-heading -mt-1 text-xl font-semibold text-slate-900">{s.title}</h3>
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
              <LandingSectionLabel>Product</LandingSectionLabel>
              <h2 className="font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{copy.showcase.title}</h2>
              <p className="mt-4 text-lg text-slate-600">{copy.showcase.subtitle}</p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {copy.showcase.items.map((f) => (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/90 p-6 shadow-sm transition hover:border-[#0072ce]/30 hover:shadow-md"
                >
                  <h3 className="font-heading font-semibold text-slate-900 group-hover:text-[#005ca8]">{f.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{f.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <LandingButton href={signupHref} variant="primary" onClick={() => onCta("product_cta", signupHref)}>
                Get Started Free
              </LandingButton>
              <Link
                href="/dashboard"
                className="text-sm font-semibold text-[#0072ce] hover:underline"
                onClick={() => onCta("product_dashboard", "/dashboard")}
              >
                Already a customer? Open dashboard →
              </Link>
            </div>
          </div>
        </section>

        {/* Social proof */}
        <section id="proof" className="scroll-mt-24 border-y border-slate-100 bg-slate-950 py-16 text-white sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:max-w-none lg:text-left">
              <p className="mb-3 inline-flex rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-200/90">
                Social proof
              </p>
              <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">{copy.proof.title}</h2>
              <p className="mt-4 text-slate-300">{copy.proof.subtitle}</p>
            </div>
            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {copy.proof.stats.map((st) => (
                <div key={st.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="font-heading text-2xl font-bold text-sky-300">{st.value}</div>
                  <p className="mt-1 text-sm text-slate-400">{st.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {copy.proof.quotes.map((q, qi) => (
                <blockquote
                  key={`quote-${qi}`}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm leading-relaxed text-slate-200"
                >
                  “{q.text}”
                  <footer className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">— {q.attribution}</footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-24 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <LandingSectionLabel>Pricing</LandingSectionLabel>
              <h2 className="font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{copy.pricing.title}</h2>
              <p className="mt-4 text-lg text-slate-600">{copy.pricing.subtitle}</p>
            </div>
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {plans.map((p) => {
                const tierHref = p.name === "Free" ? signupHref : p.href;
                return (
                <div
                  key={p.name}
                  className={`flex flex-col rounded-2xl border p-6 shadow-sm ${
                    p.highlight ? "border-[#0072ce] bg-sky-50/50 ring-2 ring-[#0072ce]/20" : "border-slate-200 bg-white"
                  }`}
                >
                  {p.highlight ? (
                    <span className="mb-3 inline-flex w-fit rounded-full bg-[#0072ce] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Best upgrade
                    </span>
                  ) : (
                    <span className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{p.blurb}</span>
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
                    href={tierHref}
                    className={`mt-8 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      p.highlight ? "bg-[#0072ce] text-white hover:bg-[#005ca8]" : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                    }`}
                    onClick={() => onCta(`pricing_${p.name}`, tierHref)}
                  >
                    {p.cta}
                  </Link>
                </div>
                );
              })}
            </div>
            <p className="mt-8 text-center text-sm text-slate-500">
              Limits and trials may apply. Compare everything on{" "}
              <Link href="/pricing" className="font-semibold text-[#0072ce] hover:underline" onClick={() => onCta("pricing_page", "/pricing")}>
                pricing
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section id="cta" className="scroll-mt-24 bg-gradient-to-r from-[#0072ce] to-[#005ca8] py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="font-heading text-3xl font-bold text-white sm:text-4xl">{copy.finalCta.title}</h2>
            <p className="mt-4 text-lg text-sky-100">{copy.finalCta.subtitle}</p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href={signupHref}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-8 py-3.5 text-base font-semibold text-[#005ca8] shadow-lg transition hover:bg-slate-100 sm:w-auto"
                onClick={() => onCta("final_primary", signupHref)}
              >
                {copy.finalCta.primary}
              </Link>
              <Link
                href="/contact"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-white/45 bg-transparent px-8 py-3.5 text-base font-semibold text-white transition hover:bg-white/10 sm:w-auto"
                onClick={() => onCta("final_contact", "/contact")}
              >
                {copy.finalCta.secondary}
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
              <Image src="/images/lslogo.png" alt="LeadSmart AI" width={140} height={40} className="h-9 w-auto opacity-90" />
              <p className="mt-3 text-sm text-slate-600">{copy.footerTagline}</p>
            </div>
            <div>
              <h3 className="font-heading text-xs font-semibold uppercase tracking-wide text-slate-500">Product</h3>
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
              <h3 className="font-heading text-xs font-semibold uppercase tracking-wide text-slate-500">Get started</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href="/agent-signup" className="text-slate-700 hover:text-[#0072ce]">
                    Agent signup
                  </Link>
                </li>
                <li>
                  <Link href="/signup" className="text-slate-700 hover:text-[#0072ce]">
                    User signup
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-slate-700 hover:text-[#0072ce]">
                    Log in
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-heading text-xs font-semibold uppercase tracking-wide text-slate-500">Legal</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href="/terms" className="text-slate-700 hover:text-[#0072ce]">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-slate-700 hover:text-[#0072ce]">
                    Privacy
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
