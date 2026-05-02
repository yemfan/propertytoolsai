import type { Metadata } from "next";
import Link from "next/link";
import {
  Bot,
  ChartBar,
  CheckCircle2,
  Clock,
  FileSignature,
  GraduationCap,
  LayoutDashboard,
  MessageSquareText,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { LeadSmartLogo } from "@/components/brand/LeadSmartLogo";

export const metadata: Metadata = {
  title: "Features — LeadSmart AI",
  description:
    "The full LeadSmart AI feature set: capture leads in under 60 seconds, qualify with behavioral scoring + sphere prediction, convert with offers / e-sign / video email, and coach toward a real annual transaction target.",
  keywords: [
    "real estate CRM features",
    "real estate AI",
    "lead capture",
    "real estate coaching",
    "BBA workflow",
    "transaction coordinator",
  ],
  alternates: { canonical: "/features" },
  openGraph: {
    title: "Features — LeadSmart AI",
    description:
      "Capture → Qualify → Convert → Coach. Real-estate-native AI for every stage of the deal, plus a coaching program tied to a real annual target.",
    url: "/features",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Features — LeadSmart AI",
    description:
      "Capture → Qualify → Convert → Coach — the full feature breakdown.",
  },
};

type Pillar = {
  id: string;
  step: string;
  title: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind background + text classes for the pillar's chip / accent. */
  chip: { bg: string; text: string; border: string; ring: string };
  /** "Hero stat" rendered as a large number in each pillar block. */
  stat: { value: string; label: string };
  /** Detailed feature cards inside the pillar. */
  features: Array<{
    icon: LucideIcon;
    title: string;
    body: string;
  }>;
};

const PILLARS: Pillar[] = [
  {
    id: "capture",
    step: "1",
    title: "Capture",
    tagline: "Reply to every lead in under 60 seconds.",
    description:
      "Inbound from Zillow, Facebook Lead Ads, your IDX site, and missed calls all hit one inbox. Source-aware AI replies pull from the lead's actual context (property, search, neighborhood) — not a generic template — and fire across SMS, email, and voice the moment they're claimed.",
    icon: Zap,
    chip: { bg: "bg-blue-50", text: "text-[#0072ce]", border: "border-blue-200", ring: "ring-blue-200" },
    stat: { value: "< 60s", label: "first reply window" },
    features: [
      {
        icon: MessageSquareText,
        title: "AI SMS + email responder",
        body: "Multi-channel first reply with the lead's name, property, and source baked in. Sales-model tones (Closer / Influencer / Advisor / Custom) so the voice matches how you actually sell.",
      },
      {
        icon: PhoneCall,
        title: "Click-to-call (Twilio bridge)",
        body: "One-tap calling from the lead detail. Caller-ID is your tracking number, calls are logged, and missed-call text-back fires automatically if you don't pick up in time.",
      },
      {
        icon: Bot,
        title: "AI voice outbound (beta)",
        body: "For the hot leads worth a real call: an AI agent handles the first conversation, qualifies, and books a showing — with a guardrail-protected handoff to you when the lead asks for a human.",
      },
      {
        icon: Users,
        title: "IDX round-robin assignment",
        body: "Team workspaces auto-route inbound to the right agent based on ZIP coverage rules, schedule availability, and a configurable round-robin so nothing sits in a shared queue.",
      },
    ],
  },
  {
    id: "qualify",
    step: "2",
    title: "Qualify",
    tagline: "Stop spending time on tire-kickers.",
    description:
      "Behavioral scoring + sphere prediction + equity signals tell you who's actually ready to transact this quarter. Hot leads bubble to the top of the queue; sphere contacts whose home value just crossed an equity threshold get nudged automatically; tire-kickers go to drip and stop interrupting the day.",
    icon: Target,
    chip: { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-200", ring: "ring-violet-200" },
    stat: { value: "3 tiers", label: "hot / warm / cold" },
    features: [
      {
        icon: ChartBar,
        title: "Behavioral scoring",
        body: "Email opens, click-through, IDX session depth, reply latency, and saved-search hits roll into a single hot/warm/cold score. Refreshed every time the contact does anything; score changes show up in the inbox sort order automatically.",
      },
      {
        icon: TrendingUp,
        title: "Sphere prediction + equity signals",
        body: "Past clients and personal sphere get a likely-seller score that combines years owned, equity built, life-event signals, and refi pressure. Crosses a threshold? They land in the both-high cohort and start a tailored drip on their schedule.",
      },
      {
        icon: FileSignature,
        title: "Buyer Broker Agreement (BBA) workflow",
        body: "Template, send, and track Buyer Broker Agreements without leaving the lead. E-sign + auto-reminders + status badge in the lead header so you always know where the agreement stands before showing up to a tour.",
      },
      {
        icon: Clock,
        title: "Showings tracker + feedback capture",
        body: "Schedule with one click, capture buyer feedback right at the curb (love / like / maybe / pass + would-offer flag), and feed it back into seller weekly updates without copying anything between tools.",
      },
    ],
  },
  {
    id: "convert",
    step: "3",
    title: "Convert",
    tagline: "Move qualified buyers to closing in one place.",
    description:
      "Offers, video email, e-sign, and the per-deal transaction coordinator share the same timeline. The Coordinator kanban shows every in-flight deal grouped by stage (contract → inspection → appraisal → loan → closing) so you see exactly what work is open right now and what's overdue.",
    icon: TrendingUp,
    chip: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", ring: "ring-emerald-200" },
    stat: { value: "5 stages", label: "from contract to keys" },
    features: [
      {
        icon: LayoutDashboard,
        title: "Transaction Coordinator kanban",
        body: "One column per stage of the deal. Cards sort overdue-first, show next-up tasks per stage, and link straight into the per-deal detail with a sticky stage stepper that collapses completed work.",
      },
      {
        icon: FileSignature,
        title: "Offer tracker + e-sign",
        body: "Buyer-side offers track drafts, counters, and acceptance — at acceptance the deal converts to a transaction and the seed task list (CA-standard contingency deadlines) is auto-populated.",
      },
      {
        icon: MessageSquareText,
        title: "Video email + tracking",
        body: "Record a 30-second video right from the compose box, send it, and watch open + click-through come back into the contact's timeline — same shape as text email tracking.",
      },
      {
        icon: ShieldCheck,
        title: "Wire-fraud anti-fraud SMS",
        body: "Closing-week wire instructions get a system-tagged SMS that reminds the buyer to verify by phone before sending. Anti-fraud task is seeded into every transaction and nudged until acknowledged.",
      },
    ],
  },
  {
    id: "coach",
    step: "4",
    title: "Coach",
    tagline: "Turn the dashboard into a producer-development program.",
    description:
      "LeadSmart AI Coaching ties the daily plan, weekly playbook, and monthly review to a real annual transaction target — Producer Track is 10 deals at 3% conversion; Top Producer Track is 15 deals at 5%. AI deep-dives spot what's slipping (response time, drip health, past-due deals) and suggest the next play.",
    icon: GraduationCap,
    chip: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200", ring: "ring-amber-200" },
    stat: { value: "10 → 15", label: "deals / yr targets" },
    features: [
      {
        icon: Sparkles,
        title: "Producer Track (Pro)",
        body: "10 transactions / year goal, 3% conversion benchmark. Daily prospecting plan, weekly accountability check-in, monthly performance review with AI-generated coaching notes.",
      },
      {
        icon: GraduationCap,
        title: "Top Producer Track (Premium / Team)",
        body: "15 transactions / year, 5% conversion. Adds advanced playbooks, sphere monetization deep-dives, and team-leader benchmarks for shops running multi-agent workspaces.",
      },
      {
        icon: ChartBar,
        title: "Performance + commission forecast",
        body: "Closed-deal revenue dashboard plus a forward-looking commission forecast that weights in-flight deals by close-date proximity. Past-due timelines get a heavy discount so the projection stays honest.",
      },
      {
        icon: CheckCircle2,
        title: "Playbooks + tasks",
        body: "Curated checklists for common workflows (Write an offer, Seller presentation, Listing launch, Host an open house, Close transaction). Apply with one click — anchor a date and the per-task due dates auto-fill.",
      },
    ],
  },
];

const PLATFORM_FOUNDATIONS = [
  {
    icon: LayoutDashboard,
    title: "Real-time inbox",
    body: "SMS, email, and voice messages stream into one inbox per contact. No tab-switching between Twilio / Resend / your CRM.",
  },
  {
    icon: ShieldCheck,
    title: "TCPA + 10DLC compliant",
    body: "Consent capture on every form, audited disclosure versions per locale, and registered 10DLC SMS allocation built in.",
  },
  {
    icon: Users,
    title: "Team workspace",
    body: "Multi-agent rosters with role gating, shared lead routing, and team-level rollups for managing brokerages.",
  },
  {
    icon: Bot,
    title: "Mobile app",
    body: "iOS + Android apps for the inbox, lead detail, click-to-call, and the transaction coordinator. Full parity with the web flows you use most.",
  },
];

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-slate-950">
      {/* ── Top bar ─── */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" aria-label="LeadSmart AI home">
            <LeadSmartLogo className="max-w-[180px]" priority />
          </Link>
          <nav className="hidden items-center gap-7 text-sm md:flex">
            <Link href="/#problem" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Problem</Link>
            <Link href="/#solution" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Solution</Link>
            <Link href="/#how" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">How It Works</Link>
            <Link href="/features" className="font-semibold text-[#0072ce] dark:text-[#4da3e8]" aria-current="page">Features</Link>
            <Link href="/pricing" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Pricing</Link>
          </nav>
          <Link
            href="/signup"
            className="rounded-xl bg-[#0072ce] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#005ba8]"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* ── Hero ─── */}
      <section className="px-6 py-20 md:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0072ce]">
            Every feature, in one place
          </p>
          <h1 className="mt-4 font-heading text-4xl font-bold tracking-tight text-slate-900 md:text-5xl dark:text-white">
            The full LeadSmart AI{" "}
            <span className="bg-gradient-to-r from-[#0072ce] to-[#4F46E5] bg-clip-text text-transparent">
              feature set
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-slate-600 md:text-lg dark:text-slate-400">
            Real-estate-native AI at every stage of the deal — from first reply to closing table to
            next year's 15th transaction. Not a generic sales CRM with AI sprinkled on.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-xl bg-[#0072ce] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#005ba8]"
            >
              Start free — 14-day trial on paid plans
            </Link>
            <Link
              href="/pricing"
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ── Workflow diagram ─── */}
      <section className="px-6 pb-12">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-8 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              The deal workflow
            </p>
            <div className="mt-6 grid grid-cols-1 items-center gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
              {PILLARS.map((p, i) => (
                <FlowNode key={p.id} pillar={p} isLast={i === PILLARS.length - 1} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pillars ─── */}
      {PILLARS.map((pillar) => (
        <section
          key={pillar.id}
          id={pillar.id}
          className="border-t border-slate-200/80 px-6 py-16 dark:border-slate-800 md:py-20"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
              {/* Pillar header + stat */}
              <div>
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${pillar.chip.bg} ${pillar.chip.text} ring-1 ${pillar.chip.ring}`}
                >
                  Step {pillar.step}
                </span>
                <h2 className="mt-4 font-heading text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">
                  {pillar.title}
                </h2>
                <p className="mt-3 text-lg font-semibold text-slate-700 dark:text-slate-300">
                  {pillar.tagline}
                </p>
                <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {pillar.description}
                </p>

                {/* Hero stat — single big number per pillar. Functions
                    as a visual anchor so each pillar has one
                    take-home metric, not just a wall of text. */}
                <div
                  className={`mt-6 inline-flex flex-col rounded-2xl border-2 ${pillar.chip.border} ${pillar.chip.bg} px-6 py-4`}
                >
                  <span
                    className={`font-heading text-3xl font-extrabold ${pillar.chip.text} md:text-4xl`}
                  >
                    {pillar.stat.value}
                  </span>
                  <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    {pillar.stat.label}
                  </span>
                </div>
              </div>

              {/* Feature grid */}
              <div className="grid gap-4 sm:grid-cols-2">
                {pillar.features.map((f) => (
                  <div
                    key={f.title}
                    className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div
                      className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${pillar.chip.bg} ${pillar.chip.text}`}
                    >
                      <f.icon size={20} strokeWidth={2} aria-hidden />
                    </div>
                    <h3 className="font-heading text-sm font-bold text-slate-900 dark:text-white">
                      {f.title}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {f.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* ── Platform foundations ─── */}
      <section className="border-t border-slate-200/80 bg-slate-50/70 px-6 py-16 dark:border-slate-800 dark:bg-slate-900/30 md:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0072ce]">
              Platform foundations
            </p>
            <h2 className="mt-2 font-heading text-2xl font-semibold md:text-3xl dark:text-white">
              Built right under the hood
            </h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 md:text-base">
              The boring-but-load-bearing stuff that makes everything else above actually work in production.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLATFORM_FOUNDATIONS.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <f.icon size={20} strokeWidth={2} aria-hidden />
                </div>
                <h3 className="font-heading text-sm font-bold text-slate-900 dark:text-white">
                  {f.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─── */}
      <section className="px-6 py-16 md:py-20">
        <div className="mx-auto max-w-4xl rounded-3xl bg-gradient-to-br from-[#0072ce] to-[#4F46E5] px-10 py-14 text-center text-white shadow-xl">
          <h2 className="font-heading text-3xl font-bold md:text-4xl">
            Run your next 10 deals on LeadSmart.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-white/90 md:text-base">
            Free to start. 14-day trial on paid plans. Cancel anytime.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#0072ce] shadow-sm transition hover:bg-slate-50"
            >
              Get my first leads
            </Link>
            <Link
              href="/pricing"
              className="rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Compare plans
            </Link>
          </div>
        </div>
      </section>

      {/* Footer is provided by AppShell — see components/AppShell.tsx
          which renders <Footer /> for every non-dashboard public page. */}
    </main>
  );
}

/**
 * Workflow node + connector arrow. Renders a numbered chip with the
 * pillar's icon and a short label, plus an arrow to the next pillar
 * (suppressed on the last node). The grid template in the parent
 * alternates `1fr_auto`, so each node takes a flex slot and the arrow
 * takes a content-sized slot — clean horizontal flow on desktop,
 * stacks vertically on narrow viewports without overflow.
 */
function FlowNode({ pillar, isLast }: { pillar: Pillar; isLast: boolean }) {
  return (
    <>
      <Link
        href={`#${pillar.id}`}
        className={`flex flex-col items-center rounded-2xl border-2 ${pillar.chip.border} bg-white px-3 py-4 text-center transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900`}
      >
        <span
          className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${pillar.chip.bg} ${pillar.chip.text}`}
        >
          <pillar.icon size={22} strokeWidth={2} aria-hidden />
        </span>
        <span className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Step {pillar.step}
        </span>
        <span className="font-heading text-base font-bold text-slate-900 dark:text-white">
          {pillar.title}
        </span>
      </Link>
      {!isLast ? (
        <span aria-hidden className="hidden text-2xl text-slate-400 md:block">
          →
        </span>
      ) : null}
    </>
  );
}
