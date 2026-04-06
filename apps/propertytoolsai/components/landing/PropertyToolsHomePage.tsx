"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const LEADSMART_URL = process.env.NEXT_PUBLIC_LEADSMART_URL ?? "https://www.leadsmart-ai.com";

/* ── Scroll-triggered fade-in hook ── */
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

/* ── Animated counter ── */
function AnimatedStat({ value, label }: { value: string; label: string }) {
  const { ref, visible } = useScrollReveal();
  return (
    <div ref={ref} className="text-center">
      <p
        className="text-xl font-bold text-[#0072ce] md:text-2xl"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.85)",
          transition: "opacity 0.5s ease-out 0.15s, transform 0.5s ease-out 0.15s",
        }}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-gray-500 md:text-sm">{label}</p>
    </div>
  );
}

type ToolCard = {
  title: string;
  description: string;
  href: string;
  badge?: string;
};

const tools: ToolCard[] = [
  {
    title: "Home Value Estimator",
    description: "Get an instant AI-powered estimate of your property's current market value — with confidence range and comparable sales.",
    href: "/home-value",
    badge: "Most Popular",
  },
  {
    title: "Mortgage Calculator",
    description: "See your exact monthly payment broken down by principal, interest, taxes, and insurance. Adjust rates in real time.",
    href: "/mortgage-calculator",
  },
  {
    title: "Affordability Calculator",
    description: "Find out exactly how much house you can afford based on your income, debt, and down payment — in seconds.",
    href: "/affordability-calculator",
  },
  {
    title: "AI Property Comparison",
    description: "Let AI analyze two or more properties side by side — price per sqft, investment potential, monthly cost, and more.",
    href: "/ai-property-comparison",
  },
  {
    title: "Refinance Analyzer",
    description: "See if refinancing saves you money with a real break-even analysis factoring in closing costs and rate changes.",
    href: "/refinance-calculator",
  },
  {
    title: "Rent vs Buy Calculator",
    description: "Compare total cost of renting vs buying over 5, 10, or 20 years. See which builds more wealth for your situation.",
    href: "/rent-vs-buy-calculator",
  },
];

const testimonials = [
  {
    quote: "The home value estimator was way more accurate than Zillow. Helped me price my listing right — sold in 4 days.",
    name: "Sandra K.",
    role: "Home Seller · Phoenix, AZ",
  },
  {
    quote: "Used the mortgage calculator before every offer. Knowing my real monthly number gave me confidence to negotiate.",
    name: "David L.",
    role: "First-Time Buyer · Atlanta, GA",
  },
  {
    quote: "The property comparison AI saved me weeks of spreadsheet work. I found my investment property in a weekend.",
    name: "Tina M.",
    role: "Real Estate Investor · Chicago, IL",
  },
];

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "All the core tools, no account required.",
    features: [
      "Home value estimates",
      "Mortgage & refinance calculators",
      "Affordability calculator",
      "Rent vs buy analysis",
      "Basic property comparison",
    ],
    cta: "Get Started Free",
    href: "/home-value",
    highlighted: false,
  },
  {
    name: "Premium",
    price: "$19",
    period: "/month",
    description: "Deeper insights for serious buyers and investors.",
    features: [
      "Everything in Free",
      "Full home value report with confidence range",
      "AI property comparison (unlimited)",
      "Market trend overlays",
      "Saved searches & alerts",
      "Priority support",
    ],
    cta: "Try Premium Free",
    href: "/pricing",
    highlighted: true,
  },
];

const exploreLinks = [
  { label: "Home Value in Los Angeles", href: "/growth/seo/home-value-estimator/los-angeles-ca" },
  { label: "Mortgage Calculator California", href: "/growth/seo/mortgage-calculator/los-angeles-ca" },
  { label: "Affordability Calculator 2026", href: "/affordability-calculator" },
  { label: "Rent vs Buy Los Angeles", href: "/growth/seo/rent-vs-buy-calculator/los-angeles-ca" },
] as const;

export default function PropertyToolsHomePage() {
  return (
    <div className="bg-white text-gray-900 dark:bg-slate-950 dark:text-slate-100">

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-slate-50 via-white to-white px-4 py-20 text-center md:px-6 md:py-28 dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
        {/* Animated gradient orb */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,114,206,0.22), transparent 60%)",
          }}
        />
        {/* Secondary accent orb */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(ellipse 40% 40% at 80% 20%, rgba(79,70,229,0.12), transparent 50%)",
          }}
        />

        <div className="relative mx-auto max-w-3xl">
          <div
            className="mb-5 inline-flex rounded-full border border-blue-200/80 bg-white/90 px-4 py-1.5 text-xs font-medium text-blue-700 shadow-sm backdrop-blur-sm dark:border-blue-500/30 dark:bg-slate-800/80 dark:text-blue-300"
            style={{ animation: "fadeInUp 0.6s ease-out" }}
          >
            Free AI tools for buyers, sellers &amp; investors
          </div>
          <h1
            className="text-4xl font-bold leading-tight tracking-tight text-gray-950 md:text-5xl lg:text-[3.25rem] dark:text-white"
            style={{ animation: "fadeInUp 0.6s ease-out 0.1s both" }}
          >
            Know Exactly What a Home Is Worth —<br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-[#0072ce] to-[#4F46E5] bg-clip-text text-transparent"> Before You Buy, Sell, or Refinance</span>
          </h1>
          <p
            className="mx-auto mt-5 max-w-2xl text-lg text-gray-600 dark:text-slate-400"
            style={{ animation: "fadeInUp 0.6s ease-out 0.2s both" }}
          >
            AI-powered real estate calculators that give you real numbers — not ballpark guesses. Used by buyers, sellers, and investors to make smarter decisions.
          </p>
          <div
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
            style={{ animation: "fadeInUp 0.6s ease-out 0.3s both" }}
          >
            <Link
              href="/home-value"
              className="rounded-2xl bg-gradient-to-r from-[#0072ce] to-[#4F46E5] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#0072ce]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#0072ce]/30 hover:brightness-110 active:scale-[0.98]"
            >
              Check Your Home Value Free
            </Link>
            <Link
              href="#tools"
              className="rounded-2xl border border-slate-200 bg-white px-7 py-3.5 text-sm font-semibold text-gray-900 transition-all duration-200 hover:bg-gray-50 hover:border-slate-300 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              Browse All Tools
            </Link>
          </div>
          <p
            className="mt-4 text-xs text-slate-500 dark:text-slate-500"
            style={{ animation: "fadeInUp 0.6s ease-out 0.4s both" }}
          >
            No sign-up required · Instant results · Free forever
          </p>
        </div>
      </section>

      {/* STATS STRIP */}
      <section className="border-b border-slate-100 bg-slate-50 px-4 py-6 md:px-6 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mx-auto grid max-w-4xl grid-cols-3 gap-4">
          <AnimatedStat value="6 Tools" label="All free to use" />
          <AnimatedStat value="Instant" label="Results in seconds" />
          <AnimatedStat value="AI-Powered" label="Backed by real data" />
        </div>
      </section>

      {/* TOOL GRID */}
      <section id="tools" className="bg-gray-50 px-4 py-16 md:px-6 md:py-20 dark:bg-slate-900/30">
        <div className="mx-auto max-w-6xl">
          <RevealSection>
            <h2 className="text-2xl font-bold text-gray-900 md:text-3xl dark:text-white">Popular Tools</h2>
            <p className="mt-2 text-base text-gray-600 dark:text-slate-400">
              Every tool is free. No account required for core features.
            </p>
          </RevealSection>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {tools.map((tool, i) => (
              <RevealSection key={tool.title} delay={i * 80}>
                <Link
                  href={tool.href}
                  className="group relative flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#0072ce]/30 hover:shadow-lg hover:shadow-[#0072ce]/[0.08] dark:border-slate-700 dark:bg-slate-900 dark:hover:border-[#4da3e8]/40 dark:hover:shadow-[#0072ce]/[0.12]"
                >
                  {tool.badge && (
                    <span className="absolute right-4 top-4 rounded-full bg-[#0072ce]/10 px-2.5 py-0.5 text-xs font-semibold text-[#0072ce] dark:bg-[#0072ce]/20 dark:text-[#4da3e8]">
                      {tool.badge}
                    </span>
                  )}
                  <h3 className="text-base font-semibold text-gray-900 transition-colors group-hover:text-[#0072ce] dark:text-white dark:group-hover:text-[#4da3e8]">{tool.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600 dark:text-slate-400">{tool.description}</p>
                  <p className="mt-4 text-xs font-semibold text-[#0072ce] transition-transform group-hover:translate-x-0.5 dark:text-[#4da3e8]">
                    Try free <span aria-hidden>→</span>
                  </p>
                </Link>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="px-4 py-16 md:px-6 md:py-20 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl">
          <RevealSection>
            <h2 className="text-center text-2xl font-bold text-gray-900 md:text-3xl dark:text-white">What Users Are Saying</h2>
          </RevealSection>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <RevealSection key={t.name} delay={i * 100}>
                <div className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
                  <div className="mb-3 flex gap-0.5 text-amber-400">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <svg key={j} className="h-4 w-4 fill-current" viewBox="0 0 20 20" aria-hidden>
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
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
      <section id="pricing" className="bg-slate-50 px-4 py-16 md:px-6 md:py-20 dark:bg-slate-900/30">
        <div className="mx-auto max-w-4xl text-center">
          <RevealSection>
            <h2 className="text-2xl font-bold text-gray-900 md:text-3xl dark:text-white">Simple, Transparent Pricing</h2>
            <p className="mt-2 text-gray-600 dark:text-slate-400">Start free. Upgrade when you need more.</p>
          </RevealSection>
          <div className="mx-auto mt-10 grid max-w-3xl gap-6 md:grid-cols-2">
            {pricingPlans.map((plan, i) => (
              <RevealSection key={plan.name} delay={i * 120}>
                <div
                  className={`relative rounded-2xl border p-6 text-left shadow-sm transition-all duration-300 hover:shadow-md ${
                    plan.highlighted
                      ? "scale-[1.02] border-2 border-[#0072ce] bg-white ring-2 ring-[#0072ce]/10 dark:bg-slate-900 dark:ring-[#0072ce]/20"
                      : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                  }`}
                >
                  {plan.highlighted && (
                    <div className="mb-3 inline-flex rounded-full bg-gradient-to-r from-[#0072ce] to-[#4F46E5] px-3 py-0.5 text-xs font-semibold text-white">
                      Most Popular
                    </div>
                  )}
                  <h3 className="font-heading text-lg font-semibold dark:text-white">{plan.name}</h3>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">{plan.price}</span>
                    <span className="text-sm text-gray-500 dark:text-slate-400">{plan.period}</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">{plan.description}</p>
                  <ul className="mt-5 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                        <svg className="h-4 w-4 flex-shrink-0 text-[#0072ce]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.href}
                    className={`mt-6 block w-full rounded-xl py-2.5 text-center text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
                      plan.highlighted
                        ? "bg-gradient-to-r from-[#0072ce] to-[#4F46E5] text-white shadow-md shadow-[#0072ce]/20 hover:shadow-lg hover:brightness-110"
                        : "border border-slate-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* CROSS-PROMO — LeadSmart AI */}
      <section className="border-y border-slate-200/80 px-4 py-16 md:px-6 md:py-20 dark:border-slate-800">
        <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
          <RevealSection>
            <div className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700 dark:border-orange-500/30 dark:bg-orange-900/20 dark:text-orange-300">
              For Real Estate Agents
            </div>
            <h2 className="mt-3 text-2xl font-bold text-gray-900 md:text-3xl dark:text-white">
              Turn Your Website Traffic into Signed Clients
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-slate-400">
              PropertyTools drives traffic. <strong className="text-gray-900 dark:text-white">LeadSmart AI</strong> converts it into closed deals — with instant AI follow-up, lead scoring, and automated nurture sequences built specifically for real estate agents.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
              {[
                "AI responds to new leads in under 60 seconds",
                "Scores and prioritizes your hottest buyers and sellers",
                "Drip sequences that nurture leads until they're ready",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <svg className="h-4 w-4 flex-shrink-0 text-[#0072ce]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <a
              href={LEADSMART_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-gray-800 hover:shadow-lg active:scale-[0.98] dark:bg-white dark:text-gray-900 dark:hover:bg-slate-100"
            >
              See LeadSmart AI
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </RevealSection>

          <RevealSection delay={150}>
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-6 shadow-inner dark:border-slate-700 dark:from-slate-800 dark:to-slate-900">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">LeadSmart AI Dashboard</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  { n: "94%", l: "Reply rate" },
                  { n: "< 60s", l: "First response" },
                  { n: "3x", l: "More tours booked" },
                  { n: "$0", l: "Manual follow-up" },
                ].map(({ n, l }) => (
                  <div key={l} className="rounded-xl border border-white/80 bg-white p-3 text-center shadow-sm transition-all duration-200 hover:shadow-md dark:border-slate-600 dark:bg-slate-800">
                    <p className="text-lg font-bold text-[#0072ce]">{n}</p>
                    <p className="text-[10px] font-medium text-gray-500 dark:text-slate-400">{l}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center text-xs text-gray-400">From agents using LeadSmart AI</p>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* SEO EXPLORE LINKS */}
      <section className="bg-gray-50 px-4 py-10 md:px-6 dark:bg-slate-900/30">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-200">Explore by City &amp; Tool</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {exploreLinks.map((link) => (
              <Link key={link.label} href={link.href} className="text-sm text-[#0072ce] transition-colors hover:text-[#005ca8] hover:underline dark:text-[#4da3e8]">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-16 md:px-6 dark:bg-slate-950">
        <div className="mx-auto max-w-4xl">
          <RevealSection>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Frequently Asked Questions</h2>
          </RevealSection>
          <div className="mt-6 space-y-4">
            {[
              {
                q: "How accurate is the home value estimate?",
                a: "Our AI uses recent comparable sales, neighborhood trends, and property data to generate estimates. For most homes, the estimate is within 5\u201310% of market value. The Premium report includes a confidence range and data sources so you can see exactly how we got there.",
              },
              {
                q: "How much house can I actually afford?",
                a: "Our affordability calculator uses your gross income, monthly debts, down payment, and current interest rates to calculate your maximum purchase price \u2014 following standard lender guidelines (28/36 DTI rule). It only takes 30 seconds.",
              },
              {
                q: "Is it better to rent or buy right now?",
                a: "It depends on your local market, how long you plan to stay, and your financial situation. Our Rent vs Buy tool runs a 10-year comparison showing total cost, net worth impact, and the break-even point specific to your numbers.",
              },
              {
                q: "Do I need to create an account?",
                a: "No account is needed for core tools \u2014 home value estimates, mortgage calculator, affordability, and rent vs buy are all free without signing up. Create a free account to save your results, set alerts, or unlock the full Premium home value report.",
              },
            ].map((faq, i) => (
              <RevealSection key={faq.q} delay={i * 60}>
                <div className="rounded-xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{faq.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-slate-400">{faq.a}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border-t border-slate-200 bg-gradient-to-br from-slate-900 via-slate-900 to-[#0072ce]/30 px-4 py-16 text-center text-white md:px-6 md:py-20 dark:border-slate-800">
        <RevealSection>
          <h2 className="text-2xl font-bold md:text-3xl">Start Making Smarter Real Estate Decisions</h2>
          <p className="mt-3 text-gray-300">Free tools. Instant results. No account required.</p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/home-value"
              className="rounded-2xl bg-white px-7 py-3 text-sm font-semibold text-gray-900 shadow-lg transition-all duration-200 hover:bg-gray-100 hover:shadow-xl active:scale-[0.98]"
            >
              Check Your Home Value
            </Link>
            <Link
              href="#tools"
              className="rounded-2xl border border-white/20 px-7 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/10 active:scale-[0.98]"
            >
              Browse All Tools
            </Link>
          </div>
        </RevealSection>
      </section>

    </div>
  );
}
