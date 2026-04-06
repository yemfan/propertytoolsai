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
      { threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li";
}) {
  const { ref, visible } = useScrollReveal();
  return (
    <Tag
      ref={ref as any}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.8s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.8s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </Tag>
  );
}

/* ── Animated counter ── */
function CountUp({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, visible } = useScrollReveal();
  useEffect(() => {
    if (!visible) return;
    let frame: number;
    const duration = 1200;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [visible, target]);
  return <span ref={ref as any}>{visible ? `${count.toLocaleString()}${suffix}` : `0${suffix}`}</span>;
}

/* ── Interactive FAQ Accordion ── */
function FaqItem({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white transition-all duration-200 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <h3 className="font-semibold text-gray-900 dark:text-white">{q}</h3>
        <svg
          className={`h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? "200px" : "0px", opacity: open ? 1 : 0 }}
      >
        <p className="px-5 pb-5 text-sm leading-relaxed text-gray-600 dark:text-slate-400">{a}</p>
      </div>
    </div>
  );
}

/* ── Tool icons (inline SVGs) ── */
const toolIcons: Record<string, React.ReactNode> = {
  "Home Value Estimator": (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ),
  "Mortgage Calculator": (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007v-.008zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z" />
    </svg>
  ),
  "Affordability Calculator": (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  "AI Property Comparison": (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
    </svg>
  ),
  "Refinance Analyzer": (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
    </svg>
  ),
  "Rent vs Buy Calculator": (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
    </svg>
  ),
};

type ToolCard = {
  title: string;
  description: string;
  href: string;
  badge?: string;
  /** Bento grid: "featured" spans 2 cols on md */
  featured?: boolean;
};

const tools: ToolCard[] = [
  {
    title: "Home Value Estimator",
    description: "Get an instant AI-powered estimate of your property's current market value — with confidence range and comparable sales.",
    href: "/home-value",
    badge: "Most Popular",
    featured: true,
  },
  {
    title: "Mortgage Calculator",
    description: "See your exact monthly payment broken down by principal, interest, taxes, and insurance.",
    href: "/mortgage-calculator",
  },
  {
    title: "Affordability Calculator",
    description: "Find out exactly how much house you can afford based on your income, debt, and down payment.",
    href: "/affordability-calculator",
  },
  {
    title: "AI Property Comparison",
    description: "Let AI analyze two or more properties side by side — price per sqft, investment potential, and more.",
    href: "/ai-property-comparison",
    badge: "AI",
  },
  {
    title: "Refinance Analyzer",
    description: "See if refinancing saves you money with a real break-even analysis factoring in closing costs.",
    href: "/refinance-calculator",
  },
  {
    title: "Rent vs Buy Calculator",
    description: "Compare total cost of renting vs buying over 5, 10, or 20 years. See which builds more wealth.",
    href: "/rent-vs-buy-calculator",
  },
];

const testimonials = [
  {
    quote: "The home value estimator was way more accurate than Zillow. Helped me price my listing right — sold in 4 days.",
    name: "Sandra K.",
    role: "Home Seller · Phoenix, AZ",
    initials: "SK",
    color: "bg-rose-500",
  },
  {
    quote: "Used the mortgage calculator before every offer. Knowing my real monthly number gave me confidence to negotiate.",
    name: "David L.",
    role: "First-Time Buyer · Atlanta, GA",
    initials: "DL",
    color: "bg-[#0072ce]",
  },
  {
    quote: "The property comparison AI saved me weeks of spreadsheet work. I found my investment property in a weekend.",
    name: "Tina M.",
    role: "Real Estate Investor · Chicago, IL",
    initials: "TM",
    color: "bg-emerald-500",
  },
];

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "All the core tools, no account required.",
    features: ["Home value estimates", "Mortgage & refinance calculators", "Affordability calculator", "Rent vs buy analysis", "Basic property comparison"],
    cta: "Get Started Free",
    href: "/home-value",
    highlighted: false,
  },
  {
    name: "Premium",
    price: "$19",
    period: "/month",
    description: "Deeper insights for serious buyers and investors.",
    features: ["Everything in Free", "Full home value report with confidence range", "AI property comparison (unlimited)", "Market trend overlays", "Saved searches & alerts", "Priority support"],
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

      {/* ═══ HERO — animated gradient mesh background ═══ */}
      <section className="relative overflow-hidden px-4 pb-8 pt-20 text-center md:px-6 md:pb-12 md:pt-28 lg:pt-32">
        {/* Animated gradient mesh */}
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-900" />
          <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-[0.15] blur-[100px] dark:opacity-[0.08]" style={{ background: "conic-gradient(from 180deg at 50% 50%, #0072ce 0deg, #4F46E5 120deg, #0072ce 240deg, #7c3aed 360deg)" }} />
          <div className="absolute right-0 top-1/4 h-[400px] w-[400px] rounded-full opacity-[0.08] blur-[80px]" style={{ background: "radial-gradient(circle, #ff8c42, transparent 70%)" }} />
        </div>

        <div className="relative mx-auto max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#0072ce]/20 bg-white/80 px-4 py-1.5 text-xs font-medium text-[#0072ce] shadow-sm shadow-[#0072ce]/5 backdrop-blur-sm dark:border-[#0072ce]/30 dark:bg-slate-900/80 dark:text-[#4da3e8]" style={{ animation: "fadeInUp 0.7s ease-out" }}>
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0072ce] opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#0072ce]" /></span>
            Free AI-powered real estate tools
          </div>
          <h1 className="font-heading text-4xl font-extrabold leading-[1.08] tracking-tight text-gray-950 sm:text-5xl lg:text-6xl dark:text-white" style={{ animation: "fadeInUp 0.7s ease-out 0.08s both" }}>
            Know What a Home Is Worth
            <br />
            <span className="bg-gradient-to-r from-[#0072ce] via-[#4F46E5] to-[#7c3aed] bg-clip-text text-transparent">Before Anyone Else</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600 md:text-xl dark:text-slate-400" style={{ animation: "fadeInUp 0.7s ease-out 0.16s both" }}>
            AI calculators that give you <strong className="text-gray-900 dark:text-white">real numbers</strong> — not ballpark guesses. Trusted by buyers, sellers, and investors making smarter decisions.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center" style={{ animation: "fadeInUp 0.7s ease-out 0.24s both" }}>
            <Link href="/home-value" className="group relative rounded-2xl bg-gradient-to-r from-[#0072ce] to-[#4F46E5] px-8 py-4 text-sm font-semibold text-white shadow-xl shadow-[#0072ce]/25 transition-all duration-300 hover:shadow-2xl hover:shadow-[#0072ce]/30 active:scale-[0.97]">
              <span className="relative z-10">Check Your Home Value Free</span>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#005ca8] to-[#3730a3] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </Link>
            <Link href="#tools" className="rounded-2xl border border-slate-200 bg-white/80 px-8 py-4 text-sm font-semibold text-gray-900 backdrop-blur-sm transition-all duration-200 hover:border-slate-300 hover:bg-white active:scale-[0.97] dark:border-slate-700 dark:bg-slate-800/80 dark:text-white dark:hover:bg-slate-700">
              Browse All Tools
            </Link>
          </div>
          <p className="mt-5 text-xs text-slate-400 dark:text-slate-500" style={{ animation: "fadeInUp 0.7s ease-out 0.32s both" }}>
            No sign-up required · Instant results · Free forever
          </p>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF STRIP — with animated counters ═══ */}
      <section className="border-y border-slate-100 bg-white px-4 py-8 md:px-6 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-4">
          {[
            { value: 50000, suffix: "+", label: "Estimates generated" },
            { value: 6, suffix: "", label: "Free tools" },
            { value: 4, suffix: ".8", label: "User rating", isStatic: true },
            { value: 30, suffix: "s", label: "Average result time" },
          ].map((s) => (
            <Reveal key={s.label} className="text-center">
              <p className="text-2xl font-extrabold text-gray-900 md:text-3xl dark:text-white">
                {s.isStatic ? `${s.value}${s.suffix}` : <CountUp target={s.value} suffix={s.suffix} />}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══ BENTO TOOL GRID ═══ */}
      <section id="tools" className="px-4 py-16 md:px-6 md:py-24 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl">
          <Reveal className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#0072ce] dark:text-[#4da3e8]">All Free. No Account Required.</p>
            <h2 className="mt-3 text-3xl font-extrabold text-gray-900 md:text-4xl dark:text-white">Real Estate Tools That Actually Help</h2>
          </Reveal>

          {/* Bento grid: featured card spans 2 cols */}
          <div className="mt-12 grid gap-4 md:grid-cols-3 md:grid-rows-[auto_auto] lg:gap-5">
            {tools.map((tool, i) => (
              <Reveal key={tool.title} delay={i * 70} className={tool.featured ? "md:col-span-2 md:row-span-2" : ""}>
                <Link
                  href={tool.href}
                  className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/[0.06] dark:border-slate-700/60 dark:bg-slate-900 dark:hover:shadow-[#0072ce]/[0.08] ${
                    tool.featured ? "p-8 md:p-10" : "p-6"
                  }`}
                >
                  {/* Gradient accent on hover */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#0072ce]/[0.02] via-transparent to-[#4F46E5]/[0.02] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                  {tool.badge && (
                    <span className={`absolute right-4 top-4 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      tool.badge === "AI"
                        ? "bg-gradient-to-r from-[#4F46E5] to-[#7c3aed] text-white"
                        : "bg-[#0072ce]/10 text-[#0072ce] dark:bg-[#0072ce]/20 dark:text-[#4da3e8]"
                    }`}>
                      {tool.badge}
                    </span>
                  )}

                  {/* Icon */}
                  <div className={`flex items-center justify-center rounded-xl bg-gradient-to-br from-[#0072ce]/10 to-[#4F46E5]/10 text-[#0072ce] transition-colors group-hover:from-[#0072ce]/20 group-hover:to-[#4F46E5]/20 dark:from-[#0072ce]/15 dark:to-[#4F46E5]/15 ${tool.featured ? "mb-5 h-14 w-14" : "mb-4 h-11 w-11"}`}>
                    {toolIcons[tool.title]}
                  </div>

                  <h3 className={`font-heading font-bold text-gray-900 transition-colors group-hover:text-[#0072ce] dark:text-white dark:group-hover:text-[#4da3e8] ${tool.featured ? "text-xl" : "text-base"}`}>
                    {tool.title}
                  </h3>
                  <p className={`mt-2 flex-1 leading-relaxed text-gray-600 dark:text-slate-400 ${tool.featured ? "text-base" : "text-sm"}`}>
                    {tool.description}
                  </p>
                  <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-[#0072ce] transition-transform duration-200 group-hover:translate-x-1 dark:text-[#4da3e8]">
                    Try free
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF — with avatars ═══ */}
      <section className="bg-slate-50 px-4 py-16 md:px-6 md:py-24 dark:bg-slate-900/30">
        <div className="mx-auto max-w-6xl">
          <Reveal className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 md:text-4xl dark:text-white">Trusted by Real People</h2>
            <p className="mt-3 text-base text-gray-500 dark:text-slate-400">Hear from buyers, sellers, and investors who use our tools</p>
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 120}>
                <div className="flex h-full flex-col rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700/50 dark:bg-slate-900">
                  <div className="mb-4 flex gap-0.5 text-amber-400">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <svg key={j} className="h-4 w-4 fill-current" viewBox="0 0 20 20" aria-hidden>
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <blockquote className="flex-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <footer className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${t.color}`}>
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.role}</p>
                    </div>
                  </footer>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" className="px-4 py-16 md:px-6 md:py-24 dark:bg-slate-950">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <h2 className="text-3xl font-extrabold text-gray-900 md:text-4xl dark:text-white">Simple, Transparent Pricing</h2>
            <p className="mt-3 text-base text-gray-500 dark:text-slate-400">Start free. Upgrade when you need more.</p>
          </Reveal>
          <div className="mx-auto mt-12 grid max-w-3xl gap-6 md:grid-cols-2">
            {pricingPlans.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 120}>
                <div className={`relative overflow-hidden rounded-2xl border p-7 text-left transition-all duration-300 hover:shadow-lg ${
                  plan.highlighted
                    ? "border-[#0072ce]/40 bg-gradient-to-b from-white to-[#0072ce]/[0.03] shadow-lg shadow-[#0072ce]/[0.08] ring-1 ring-[#0072ce]/20 dark:from-slate-900 dark:to-[#0072ce]/[0.06] dark:ring-[#0072ce]/30"
                    : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                }`}>
                  {plan.highlighted && (
                    <div className="absolute -right-8 top-5 rotate-45 bg-gradient-to-r from-[#0072ce] to-[#4F46E5] px-10 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">Popular</div>
                  )}
                  <h3 className="font-heading text-lg font-bold dark:text-white">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-gray-900 dark:text-white">{plan.price}</span>
                    <span className="text-sm text-gray-500 dark:text-slate-400">{plan.period}</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">{plan.description}</p>
                  <ul className="mt-6 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0072ce]/10 dark:bg-[#0072ce]/20">
                          <svg className="h-3 w-3 text-[#0072ce]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href={plan.href} className={`mt-7 block w-full rounded-xl py-3 text-center text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
                    plan.highlighted
                      ? "bg-gradient-to-r from-[#0072ce] to-[#4F46E5] text-white shadow-lg shadow-[#0072ce]/20 hover:shadow-xl hover:brightness-110"
                      : "border border-slate-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                  }`}>
                    {plan.cta}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CROSS-PROMO — LeadSmart AI ═══ */}
      <section className="relative overflow-hidden bg-slate-50 px-4 py-16 md:px-6 md:py-24 dark:bg-slate-900/30">
        <div className="pointer-events-none absolute right-0 top-0 h-[300px] w-[300px] rounded-full opacity-[0.06] blur-[80px]" style={{ background: "#ff8c42" }} aria-hidden />
        <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-2">
          <Reveal>
            <div className="inline-flex rounded-full border border-orange-200/80 bg-orange-50 px-4 py-1.5 text-xs font-semibold text-orange-700 dark:border-orange-500/30 dark:bg-orange-900/20 dark:text-orange-300">
              For Real Estate Agents
            </div>
            <h2 className="mt-4 text-3xl font-extrabold leading-tight text-gray-900 md:text-4xl dark:text-white">
              Turn Traffic into<br />Signed Clients
            </h2>
            <p className="mt-5 text-base leading-relaxed text-gray-600 dark:text-slate-400">
              PropertyTools drives traffic. <strong className="text-gray-900 dark:text-white">LeadSmart AI</strong> converts it into closed deals — instant AI follow-up, lead scoring, and automated nurture sequences.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate-700 dark:text-slate-300">
              {["AI responds to new leads in under 60 seconds", "Scores and prioritizes your hottest buyers", "Drip sequences that nurture until they're ready"].map((f) => (
                <li key={f} className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0072ce]/10 dark:bg-[#0072ce]/20">
                    <svg className="h-3.5 w-3.5 text-[#0072ce]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  {f}
                </li>
              ))}
            </ul>
            <a href={LEADSMART_URL} target="_blank" rel="noopener noreferrer" className="group mt-8 inline-flex items-center gap-2 rounded-2xl bg-gray-900 px-7 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-gray-800 hover:shadow-lg active:scale-[0.97] dark:bg-white dark:text-gray-900 dark:hover:bg-slate-100">
              See LeadSmart AI
              <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </a>
          </Reveal>
          <Reveal delay={150}>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl shadow-slate-900/[0.06] dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-700">
                <div className="h-3 w-3 rounded-full bg-red-400" /><div className="h-3 w-3 rounded-full bg-amber-400" /><div className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-2 text-[10px] font-medium text-slate-400">LeadSmart AI Dashboard</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  { n: "94%", l: "Reply rate", color: "text-[#0072ce]" },
                  { n: "< 60s", l: "First response", color: "text-emerald-600" },
                  { n: "3x", l: "More tours booked", color: "text-[#4F46E5]" },
                  { n: "$0", l: "Manual follow-up", color: "text-[#ff8c42]" },
                ].map(({ n, l, color }) => (
                  <div key={l} className="rounded-xl bg-slate-50 p-3.5 text-center transition-all duration-200 hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700">
                    <p className={`text-xl font-extrabold ${color}`}>{n}</p>
                    <p className="mt-0.5 text-[10px] font-medium text-gray-500 dark:text-slate-400">{l}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-[10px] font-medium text-slate-400">
                  <span>Pipeline health</span><span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />Live</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-[#0072ce] to-[#4F46E5]" />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ SEO EXPLORE ═══ */}
      <section className="border-y border-slate-100 px-4 py-10 md:px-6 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-200">Explore by City &amp; Tool</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {exploreLinks.map((link) => (
              <Link key={link.label} href={link.href} className="group flex items-center gap-2 text-sm text-[#0072ce] transition-colors hover:text-[#005ca8] dark:text-[#4da3e8]">
                <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ — Interactive Accordion ═══ */}
      <section className="px-4 py-16 md:px-6 md:py-24 dark:bg-slate-950">
        <div className="mx-auto max-w-3xl">
          <Reveal className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">Questions? We&apos;ve Got Answers</h2>
          </Reveal>
          <div className="mt-10 space-y-3">
            <FaqItem q="How accurate is the home value estimate?" a="Our AI uses recent comparable sales, neighborhood trends, and property data to generate estimates. For most homes, the estimate is within 5–10% of market value. The Premium report includes a confidence range and data sources so you can see exactly how we got there." defaultOpen />
            <FaqItem q="How much house can I actually afford?" a="Our affordability calculator uses your gross income, monthly debts, down payment, and current interest rates to calculate your maximum purchase price — following standard lender guidelines (28/36 DTI rule). It only takes 30 seconds." />
            <FaqItem q="Is it better to rent or buy right now?" a="It depends on your local market, how long you plan to stay, and your financial situation. Our Rent vs Buy tool runs a 10-year comparison showing total cost, net worth impact, and the break-even point specific to your numbers." />
            <FaqItem q="Do I need to create an account?" a="No account is needed for core tools — home value estimates, mortgage calculator, affordability, and rent vs buy are all free without signing up. Create a free account to save your results, set alerts, or unlock the full Premium home value report." />
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="relative overflow-hidden px-4 py-20 text-center text-white md:px-6 md:py-28">
        <div className="absolute inset-0 -z-10 bg-gray-950" />
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <div className="absolute left-1/2 top-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.12] blur-[100px]" style={{ background: "conic-gradient(from 0deg at 50% 50%, #0072ce 0deg, #4F46E5 120deg, #7c3aed 240deg, #0072ce 360deg)" }} />
        </div>
        <Reveal>
          <h2 className="text-3xl font-extrabold md:text-4xl lg:text-5xl">Make Smarter Real Estate Decisions</h2>
          <p className="mt-4 text-lg text-gray-400">Free tools. Instant results. No account required.</p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/home-value" className="rounded-2xl bg-white px-8 py-4 text-sm font-semibold text-gray-900 shadow-xl transition-all duration-200 hover:bg-gray-100 hover:shadow-2xl active:scale-[0.97]">
              Check Your Home Value
            </Link>
            <Link href="#tools" className="rounded-2xl border border-white/20 bg-white/5 px-8 py-4 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/10 active:scale-[0.97]">
              Browse All Tools
            </Link>
          </div>
        </Reveal>
      </section>

    </div>
  );
}
