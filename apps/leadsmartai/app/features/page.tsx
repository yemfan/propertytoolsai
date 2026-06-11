import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  Filter,
  Globe2,
  HandHeart,
  HeartHandshake,
  LayoutGrid,
  LineChart,
  MessageCircle,
  MessagesSquare,
  PhoneCall,
  PhoneMissed,
  Settings2,
  Sparkles,
  TrendingUp,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Features — RealtorBoss",
  description:
    "A complete AI system to turn leads into closed deals — capture, qualify, follow up, convert, and scale, including Missed Call Recovery AI and an AI Sales Style Engine that adapts to how you sell.",
  keywords: [
    "real estate CRM features",
    "real estate AI",
    "missed call recovery",
    "AI lead capture",
    "AI follow up",
    "real estate sales coaching",
  ],
  alternates: { canonical: "/features" },
  openGraph: {
    title: "Features — RealtorBoss",
    description:
      "Capture → Qualify → Follow Up → Convert → Close. The full RealtorBoss feature breakdown, including the Missed Call Recovery AI signature feature.",
    url: "/features",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Features — RealtorBoss",
    description: "The full RealtorBoss feature set in one page.",
  },
};

const PRIMARY_CTA_HREF = "/onboarding";

export default function FeaturesPage() {
  /* AppShell already wraps non-home pages with `MarketingTopChrome`
   * (top bar) + `PremiumSidebar` + `Footer`. The page's own
   * `<header>` was stacking on top of that, producing two top bars
   * and two `<main>` landmarks. Drop both — emit just the section
   * content and let AppShell own the chrome. */
  return (
    <>
      {/* ── HERO ─── */}
      <section className="relative overflow-hidden border-b border-slate-200/70 bg-gradient-to-b from-slate-50 via-white to-white px-6 py-20 dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 md:py-28">
        <div className="pointer-events-none absolute inset-0 -z-0" aria-hidden>
          <div
            className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-[0.13] blur-[100px] dark:opacity-[0.08]"
            style={{
              background:
                "conic-gradient(from 180deg at 50% 50%, #0072ce 0deg, #4F46E5 120deg, #0072ce 240deg, #7c3aed 360deg)",
            }}
          />
        </div>
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0072ce]">
            Every feature, in one place
          </p>
          <h1 className="mt-4 font-heading text-4xl font-extrabold leading-[1.08] tracking-tight text-gray-950 md:text-5xl lg:text-[3.25rem] dark:text-white">
            A Complete{" "}
            <span className="bg-gradient-to-r from-[#0072ce] via-[#4F46E5] to-[#7c3aed] bg-clip-text text-transparent">
              AI System
            </span>
            <br className="hidden md:inline" /> to Turn Leads Into Closed Deals
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-slate-600 md:text-lg dark:text-slate-400">
            Capture, qualify, follow up, and convert every lead — automatically — with
            your AI-powered growth engine for real estate agents.
          </p>

          {/* Workflow tagline */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {["Capture", "Qualify", "Follow Up", "Convert", "Close"].map(
              (step, i, arr) => (
                <span key={step} className="flex items-center gap-1.5">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-[#0072ce] ring-1 ring-blue-200 dark:bg-blue-900/30 dark:text-[#4da3e8] dark:ring-blue-800">
                    {step}
                  </span>
                  {i < arr.length - 1 ? (
                    <span aria-hidden className="text-slate-400">→</span>
                  ) : null}
                </span>
              ),
            )}
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={PRIMARY_CTA_HREF}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0072ce] px-7 py-3 text-base font-semibold text-white shadow-lg shadow-[#0072ce]/20 transition hover:bg-[#005ba8] hover:shadow-xl"
            >
              Start Your AI Deal Engine
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-base font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Book a Demo
            </Link>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─── */}
      <section className="bg-slate-50/70 px-6 py-20 dark:bg-slate-900/30 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0072ce]">
              The deal flow
            </p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-slate-900 md:text-4xl dark:text-white">
              From First Click to Closing —{" "}
              <span className="bg-gradient-to-r from-[#0072ce] to-[#4F46E5] bg-clip-text text-transparent">
                handled by AI
              </span>
            </h2>
            <p className="mt-4 text-base text-slate-600 dark:text-slate-400 md:text-lg">
              RealtorBoss connects every step of your pipeline into one seamless system —
              so no lead is missed, delayed, or forgotten.
            </p>
          </div>

          <div className="mt-12">
            <FlowDiagram
              steps={[
                { label: "Traffic", icon: Globe2, tone: "slate" },
                { label: "AI Capture", icon: Filter, tone: "blue" },
                { label: "AI Qualify", icon: Sparkles, tone: "violet" },
                { label: "AI Follow-up", icon: MessagesSquare, tone: "amber" },
                { label: "Agent", icon: HandHeart, tone: "emerald" },
                { label: "Deal Closed", icon: CheckCircle2, tone: "green" },
              ]}
            />
          </div>
        </div>
      </section>

      {/* ── GROWTH ENGINE — 5 deep pillar sections ─── */}
      {GROWTH_ENGINE.map((p) => (
        <PillarSection key={p.id} pillar={p} />
      ))}

      {/* ── AI SALES STYLE ENGINE ─── */}
      <section className="border-y border-slate-200/80 bg-gradient-to-b from-white via-blue-50/30 to-white px-6 py-20 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0072ce]">
              The differentiator
            </p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-slate-900 md:text-4xl dark:text-white">
              Your AI — your sales style
            </h2>
            <p className="mt-4 text-base text-slate-600 dark:text-slate-400 md:text-lg">
              Most tools send generic messages. RealtorBoss adapts to how{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">YOU</span>{" "}
              sell.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {SALES_STYLES.map((s) => (
              <div
                key={s.name}
                className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
              >
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${s.chip.bg} ${s.chip.text}`}>
                  {s.emoji}
                </div>
                <h3 className="mt-4 font-heading text-lg font-bold text-slate-900 dark:text-white">
                  {s.name}
                </h3>
                <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {s.tagline}
                </p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {s.body}
                </p>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Best for:{" "}
                  <span className="text-slate-700 dark:text-slate-200">{s.bestFor}</span>
                </p>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-sm font-semibold text-slate-700 dark:text-slate-300">
            👉 Stand out in a crowded market.
          </p>
        </div>
      </section>

      {/* ── RESULTS ─── */}
      <section className="px-6 py-20 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0072ce]">
              Built to increase closings — not just activity
            </p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-slate-900 md:text-4xl dark:text-white">
              Speed + consistency ={" "}
              <span className="bg-gradient-to-r from-[#0072ce] to-[#4F46E5] bg-clip-text text-transparent">
                revenue
              </span>
            </h2>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {RESULTS.map((r) => (
              <div
                key={r.label}
                className="flex h-full flex-col rounded-2xl border-2 border-slate-200/80 bg-white p-7 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
              >
                <span aria-hidden className="text-3xl">
                  {r.emoji}
                </span>
                <p className="mt-3 font-heading text-4xl font-extrabold text-[#0072ce] md:text-5xl">
                  {r.value}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {r.label}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {r.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY LEADSMART AI ─── */}
      <section className="border-y border-slate-200/80 bg-slate-50/70 px-6 py-20 dark:border-slate-800 dark:bg-slate-900/30 md:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0072ce]">
              Why RealtorBoss
            </p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-slate-900 md:text-4xl dark:text-white">
              Not just a CRM —{" "}
              <span className="bg-gradient-to-r from-[#0072ce] to-[#4F46E5] bg-clip-text text-transparent">
                a full AI closing engine
              </span>
            </h2>
          </div>

          <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Traditional Tools
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#0072ce] dark:text-[#4da3e8]">
                    RealtorBoss
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {COMPARISON.map((row) => (
                  <tr key={row.left}>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                      <span className="mr-2 text-slate-400">✕</span>
                      {row.left}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">
                      <span className="mr-2 text-emerald-600">✓</span>
                      {row.right}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── ROI ─── */}
      <section className="bg-gradient-to-b from-rose-50/80 via-white to-white px-6 py-20 dark:from-rose-950/15 dark:via-slate-950 dark:to-slate-950 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-400">
            The cost of doing nothing
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold leading-tight text-slate-900 md:text-4xl dark:text-white">
            How many deals are you{" "}
            <span className="text-rose-700 dark:text-rose-400">losing right now</span>?
          </h2>
          <p className="mt-5 text-base text-slate-700 dark:text-slate-300 md:text-lg">
            If you respond late, miss calls, or forget follow-ups — you&apos;re losing
            deals every single month.
          </p>

          <div className="mx-auto mt-10 grid max-w-2xl gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Without LeadSmart
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-rose-500">✕</span>
                  Hot leads going to whoever replied first
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-rose-500">✕</span>
                  Missed calls staying missed
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-rose-500">✕</span>
                  Follow-up cadence breaking after message two
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-5 text-left shadow-sm dark:border-emerald-800 dark:bg-emerald-950/30">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                With RealtorBoss
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-600">✓</span>
                  Every lead is captured
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-600">✓</span>
                  Every lead is engaged
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-600">✓</span>
                  Every lead is nurtured
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href={PRIMARY_CTA_HREF}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0072ce] px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-[#005ba8]"
            >
              Start Closing More Deals Today
            </Link>
            <Link
              href="/agent/pricing"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-base font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Estimate Your ROI
            </Link>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─── */}
      <section className="px-6 py-20 md:py-24">
        <div className="mx-auto max-w-4xl rounded-3xl bg-gradient-to-br from-[#0072ce] via-[#4F46E5] to-[#7c3aed] px-8 py-14 text-center text-white shadow-2xl md:px-12">
          <h2 className="font-heading text-3xl font-bold leading-tight md:text-4xl">
            Your next deal is already trying to reach you.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/90 md:text-lg">
            Don&apos;t miss it.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={PRIMARY_CTA_HREF}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#0072ce] shadow-lg transition hover:bg-slate-50 md:text-base"
            >
              Activate Your AI Deal Engine
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20 md:text-base"
            >
              Book a Demo
            </Link>
          </div>
          <p className="mt-6 text-xs text-white/70">
            14-day trial on paid plans · No credit card required to start
          </p>
        </div>
      </section>

      {/* Footer is provided by AppShell — see components/AppShell.tsx
          which renders <Footer /> for every public marketing page. */}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Pillar section (Growth Engine)
 * ──────────────────────────────────────────────────────────────── */

type Pillar = {
  id: string;
  step: string;
  emoji: string;
  shortName: string;
  /** "Why it matters" lead. */
  headline: string;
  /** Body sentence under the headline. */
  rationale: string;
  /** Concrete feature bullets. */
  features: string[];
  /** Outcome line (rendered with the 👉 lead). */
  outcome: string;
  icon: LucideIcon;
  chip: { bg: string; text: string; border: string };
  /** Optional inset card (e.g., Missed Call Recovery AI™ inside Follow Up). */
  feature?: SignatureFeature;
};

type SignatureFeature = {
  badge: string;
  title: string;
  copyParagraphs: string[];
  features: string[];
  outcomes: string[];
  icon: LucideIcon;
};

const GROWTH_ENGINE: Pillar[] = [
  {
    id: "capture",
    step: "1",
    emoji: "🧲",
    shortName: "Capture",
    headline: "Turn website visitors into real opportunities",
    rationale: "Most agents lose leads before they even enter the pipeline.",
    features: [
      "Smart landing pages optimized for conversion",
      "Home value estimator (seller magnet)",
      "Lead capture forms (web + IDX + portals)",
      "CRM &amp; website integrations",
    ],
    outcome: "More leads entering your pipeline — automatically.",
    icon: Filter,
    chip: { bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-[#0072ce] dark:text-[#4da3e8]", border: "border-blue-200 dark:border-blue-800" },
  },
  {
    id: "qualify",
    step: "2",
    emoji: "⚡",
    shortName: "Qualify",
    headline: "Know who's serious — without doing the work",
    rationale: "Not all leads are equal — your time should go to the best ones.",
    features: [
      "AI lead scoring (hot vs cold)",
      "Buyer &amp; seller intent detection",
      "Data enrichment + sphere prediction",
    ],
    outcome: "Focus only on high-probability deals.",
    icon: Sparkles,
    chip: { bg: "bg-violet-50 dark:bg-violet-900/30", text: "text-violet-600 dark:text-violet-300", border: "border-violet-200 dark:border-violet-800" },
  },
  {
    id: "follow-up",
    step: "3",
    emoji: "🤖",
    shortName: "Follow Up",
    headline: "Respond to every lead in seconds — 24/7",
    rationale: "Speed is the #1 factor in converting leads.",
    features: [
      "SMS + email automation",
      "AI receptionist — answers every call &amp; books showings 24/7",
      "AI Concierge — outbound confirmations, follow-ups &amp; surveys",
      "Multi-step follow-up sequences",
      "Behavior-based triggers",
    ],
    outcome: "No more missed opportunities.",
    icon: Bot,
    chip: { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
    feature: {
      badge: "Signature feature",
      title: "Missed Call Recovery AI™",
      copyParagraphs: [
        "When you miss a call, you're not just missing a call — you're missing a potential deal.",
        "RealtorBoss instantly sends a text back, starts the conversation, and keeps engaging until the lead is ready to talk.",
      ],
      features: [
        "Instant missed-call text-back (within seconds)",
        "AI-powered SMS conversation",
        "Lead qualification via text",
        "Smart agent handoff when ready",
      ],
      outcomes: [
        "Recover lost opportunities automatically",
        "Turn missed calls into real appointments",
      ],
      icon: PhoneMissed,
    },
  },
  {
    id: "convert",
    step: "4",
    emoji: "💬",
    shortName: "Convert",
    headline: "Turn engagement into real deals",
    rationale: "Leads don't close — conversations do.",
    features: [
      "AI conversation engine",
      "Smart reply suggestions",
      "Appointment booking automation",
    ],
    outcome: "More booked calls and showings.",
    icon: MessageCircle,
    chip: { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
  },
  {
    id: "scale",
    step: "5",
    emoji: "📈",
    shortName: "Scale",
    headline: "Grow without adding more work",
    rationale: "Manual systems don't scale — AI does.",
    features: [
      "Performance dashboards",
      "AI optimization engine",
      "Automated workflows + playbooks",
    ],
    outcome: "More deals without burnout.",
    icon: LineChart,
    chip: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", border: "border-slate-200 dark:border-slate-700" },
  },
];

function PillarSection({ pillar }: { pillar: Pillar }) {
  /* Single layout for every pillar: header block on top (icon + step
   * badge + headline + rationale + outcome chip), feature grid
   * below in a 2-up. The previous alternating-side layout
   * (`flipped`) confused the reading flow — odd-numbered pillars
   * had cards on the left and text on the right, which fought the
   * natural left-to-right scan. Stacked layout is also kinder on
   * narrow viewports without `lg:order-N` reshuffling. */
  return (
    <section
      id={pillar.id}
      className="border-b border-slate-200/80 px-6 py-20 dark:border-slate-800 md:py-24"
    >
      <div className="mx-auto max-w-5xl">
        <div className="space-y-10">
          {/* Header — icon + badge + headline + rationale + outcome chip */}
          <div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl ${pillar.chip.bg} ${pillar.chip.text}`}
              >
                <pillar.icon size={26} strokeWidth={2} aria-hidden />
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Step {pillar.step} · {pillar.shortName}
              </span>
            </div>
            <h2 className="mt-5 font-heading text-3xl font-bold leading-tight text-slate-900 dark:text-white md:text-4xl">
              <span aria-hidden className="mr-2">
                {pillar.emoji}
              </span>
              {pillar.headline}
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600 dark:text-slate-400 md:text-lg">
              {pillar.rationale}
            </p>
            <p
              className={`mt-6 inline-flex max-w-md items-start gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold ${pillar.chip.bg} ${pillar.chip.text} ${pillar.chip.border}`}
            >
              <span aria-hidden>👉</span>
              <span>{pillar.outcome}</span>
            </p>
          </div>

          {/* Feature grid + optional signature card */}
          <div className="space-y-5">
            <ul
              className="grid gap-3 sm:grid-cols-2"
              aria-label={`${pillar.shortName} features`}
            >
              {pillar.features.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-sm leading-relaxed text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <span
                    className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${pillar.chip.bg} ${pillar.chip.text}`}
                    aria-hidden
                  >
                    <CheckCircle2 size={13} strokeWidth={2.5} />
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: f }} />
                </li>
              ))}
            </ul>

            {/* Signature feature inset (Follow Up only) */}
            {pillar.feature ? <SignatureFeatureCard feature={pillar.feature} /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Featured callout used inside the Follow Up pillar to spotlight
 * Missed Call Recovery AI™. Strong gradient + ™ badge so it reads as
 * the genuine signature feature it is.
 */
function SignatureFeatureCard({ feature }: { feature: SignatureFeature }) {
  return (
    <div className="overflow-hidden rounded-3xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-white to-amber-50/60 p-7 shadow-lg dark:border-amber-800/60 dark:from-amber-950/30 dark:via-slate-900 dark:to-amber-950/20">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md"
        >
          <feature.icon size={22} strokeWidth={2} />
        </span>
        <span className="rounded-full bg-amber-900 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
          📞 {feature.badge}
        </span>
      </div>

      <h3 className="mt-5 font-heading text-2xl font-bold leading-tight text-amber-900 md:text-3xl dark:text-amber-200">
        {feature.title}
      </h3>

      <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700 md:text-base dark:text-slate-300">
        {feature.copyParagraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {feature.features.map((f) => (
          <div
            key={f}
            className="flex items-start gap-2.5 rounded-xl border border-amber-200/70 bg-white/80 p-3 text-xs text-slate-700 backdrop-blur dark:border-amber-800/50 dark:bg-slate-950/60 dark:text-slate-300"
          >
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
              aria-hidden
            />
            <span>{f}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-1.5">
        {feature.outcomes.map((o) => (
          <p
            key={o}
            className="flex items-start gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200"
          >
            <span aria-hidden>👉</span>
            <span>{o}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Sub-components
 * ──────────────────────────────────────────────────────────────── */

type FlowTone = "slate" | "blue" | "violet" | "amber" | "emerald" | "green";

const FLOW_TONE: Record<FlowTone, { bg: string; text: string; border: string }> = {
  slate: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", border: "border-slate-200 dark:border-slate-700" },
  blue: { bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-[#0072ce] dark:text-[#4da3e8]", border: "border-blue-200 dark:border-blue-800" },
  violet: { bg: "bg-violet-50 dark:bg-violet-900/30", text: "text-violet-600 dark:text-violet-300", border: "border-violet-200 dark:border-violet-800" },
  amber: { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
  green: { bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-700 dark:text-green-300", border: "border-green-300 dark:border-green-700" },
};

function FlowDiagram({
  steps,
}: {
  steps: { label: string; icon: LucideIcon; tone: FlowTone }[];
}) {
  return (
    <div className="grid grid-cols-3 gap-3 md:grid-cols-6 md:gap-2">
      {steps.map((s, i) => {
        const palette = FLOW_TONE[s.tone];
        return (
          <div
            key={s.label}
            className="relative flex flex-col items-center text-center"
          >
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-2xl border-2 ${palette.border} ${palette.bg} ${palette.text}`}
            >
              <s.icon size={26} strokeWidth={2} aria-hidden />
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-700 dark:text-slate-200">
              {s.label}
            </p>
            {i < steps.length - 1 ? (
              <span
                aria-hidden
                className="pointer-events-none absolute right-[-12px] top-7 hidden text-slate-300 md:block dark:text-slate-600"
              >
                <ArrowRight size={18} strokeWidth={2.25} />
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

const SALES_STYLES: Array<{
  emoji: string;
  name: string;
  tagline: string;
  body: string;
  bestFor: string;
  chip: { bg: string; text: string };
}> = [
  {
    emoji: "🤝",
    name: "Consultative Advisor",
    tagline: "Trust-driven.",
    body: "Builds trust, educates, and nurtures over time. Long-game tone for buyers who need to feel guided through the process.",
    bestFor: "Sphere referrals · long sales cycles",
    chip: { bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-[#0072ce] dark:text-[#4da3e8]" },
  },
  {
    emoji: "⚡",
    name: "Closer Mode",
    tagline: "Fast, decisive.",
    body: "Drives urgency and fast decisions. Direct, action-oriented, designed to convert hot leads before they shop another agent.",
    bestFor: "PPC / portal leads · multiple-offer markets",
    chip: { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-300" },
  },
  {
    emoji: "💬",
    name: "Friendly Connector",
    tagline: "Relationship-first.",
    body: "Casual, warm, and personable — the tone that makes first-time buyers actually reply.",
    bestFor: "First-time buyers · social-media leads",
    chip: { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-300" },
  },
];

const RESULTS: Array<{ emoji: string; value: string; label: string; body: string }> = [
  {
    emoji: "⚡",
    value: "90%",
    label: "Faster response time",
    body: "Median first-reply time drops from minutes (or hours) to seconds — the difference between you and the next agent.",
  },
  {
    emoji: "📈",
    value: "2×",
    label: "More appointments booked",
    body: "When AI fires the first reply in under 60 seconds, more leads show up to a tour or consultation.",
  },
  {
    emoji: "💰",
    value: "↑",
    label: "Higher lead-to-close conversion",
    body: "Behavior-based follow-up keeps warm leads engaged through the silent middle of the funnel.",
  },
];

const COMPARISON: Array<{ left: string; right: string }> = [
  { left: "Manual follow-up", right: "Instant AI engagement" },
  { left: "Disconnected tools", right: "Unified system" },
  { left: "Missed leads", right: "24/7 automation" },
  { left: "Basic CRM", right: "AI growth engine" },
  { left: "Static templates", right: "Adapts to your sales style" },
];

// Imports referenced inline above — keep so future edits don't drop them.
void Calendar;
void HeartHandshake;
void LayoutGrid;
void PhoneCall;
void Settings2;
void TrendingUp;
void Wand2;
void Zap;
