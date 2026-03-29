"use client";

import Link from "next/link";
import { BrandCheck } from "@/components/brand/BrandCheck";
import { LeadSmartLogo } from "@/components/brand/LeadSmartLogo";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildDemoLeads, randomIncomingSnippet } from "./demoLeads";
import { clearOnboarding, loadOnboarding, saveOnboarding, stepToProgress } from "./storage";
import type { DemoLead, LeadFocus, OnboardingProfile, OnboardingStep, PriceRangeId } from "./types";

function effectiveProfile(p: Partial<OnboardingProfile>): OnboardingProfile {
  return {
    fullName: p.fullName?.trim() || "Agent",
    email: p.email?.trim() || "demo@preview.local",
    city: p.city?.trim() || "your market",
    focus: p.focus ?? "both",
    priceRangeId: p.priceRangeId ?? "750-1500",
  };
}

function trackOnboardingStep(step: OnboardingStep, label: string) {
  if (typeof window === "undefined") return;
  fetch("/api/growth/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_type: "onboarding_step",
      page_path: "/onboarding",
      source: "onboarding_funnel",
      metadata: { step, label },
    }),
  }).catch(() => {});
}

function ProgressBar({ step }: { step: OnboardingStep }) {
  const pct = stepToProgress(step);
  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
        <span>
          Step {step} of 8
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="onboarding-shimmer-bar h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, minWidth: step >= 1 ? "4%" : "0" }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400">Preview experience — no charge until you upgrade.</p>
    </div>
  );
}

function Shell({
  children,
  step,
}: {
  children: React.ReactNode;
  step: OnboardingStep;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,114,206,0.25),transparent)]" />
      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col px-4 py-8 sm:max-w-xl sm:px-6 sm:py-12">
        <header className="mb-6 flex items-center justify-between gap-3 onboarding-fade-up">
          <Link href="/" className="flex items-center opacity-90 transition hover:opacity-100">
            <LeadSmartLogo compact className="max-w-[200px] sm:max-w-[240px]" priority={false} />
          </Link>
          <Link
            href="/agent/pricing"
            className="text-xs font-semibold text-sky-300/90 underline-offset-2 hover:text-white hover:underline"
          >
            Pricing
          </Link>
        </header>
        <ProgressBar step={step} />
        <div className="onboarding-fade-up flex-1">{children}</div>
      </div>
    </div>
  );
}

const FOCUS_OPTIONS: { id: LeadFocus; label: string; hint: string }[] = [
  { id: "buyers", label: "Mostly buyers", hint: "Tour requests & pre-approvals" },
  { id: "sellers", label: "Mostly sellers", hint: "Listings & CMA conversations" },
  { id: "both", label: "Both equally", hint: "Mixed pipeline" },
];

const PRICE_OPTIONS: { id: PriceRangeId; label: string }[] = [
  { id: "under-750", label: "Under ~$750K" },
  { id: "750-1500", label: "$750K – $1.5M" },
  { id: "1500-plus", label: "$1.5M+" },
];

export default function OnboardingFunnel() {
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<OnboardingStep>(1);
  const [profile, setProfile] = useState<Partial<OnboardingProfile>>({});
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [hasReplied, setHasReplied] = useState(false);
  const [paywallSeen, setPaywallSeen] = useState(false);
  const [engagementPoints, setEngagementPoints] = useState(0);
  const [replyDraft, setReplyDraft] = useState("");
  const [activationLog, setActivationLog] = useState<string[]>([]);
  const [activationDone, setActivationDone] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const toastId = useRef(0);
  const incomingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const s = loadOnboarding();
    setStep(s.step);
    setProfile(s.profile);
    setSelectedLeadId(s.selectedLeadId);
    setHasReplied(s.hasReplied);
    setPaywallSeen(s.paywallSeen);
    setEngagementPoints(s.engagementPoints);
    setHydrated(true);
  }, []);

  /** If the visitor is already signed in, merge account name/email into step 1 when fields are empty. */
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = supabaseBrowser();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user || cancelled) return;
        const user = session.user;
        const { data: prof } = await supabase
          .from("user_profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .maybeSingle();
        const row = prof as { full_name?: string | null } | null;
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const metaName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
        const authEmail = user.email?.trim() ?? "";
        const fromProfile = row?.full_name?.trim() ?? "";
        const displayName = fromProfile || metaName || (authEmail ? authEmail.split("@")[0] : "");

        setProfile((p) => {
          const hasName = Boolean(p.fullName?.trim());
          const hasEmail = Boolean(p.email?.trim());
          if (hasName && hasEmail) return p;
          return {
            ...p,
            fullName: hasName ? p.fullName : displayName || p.fullName,
            email: hasEmail ? p.email : authEmail || p.email,
          };
        });
      } catch (e) {
        console.error("[OnboardingFunnel] session prefill", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveOnboarding({
      version: 1,
      step,
      profile,
      selectedLeadId,
      hasReplied,
      paywallSeen,
      engagementPoints,
      completedAt: step >= 8 ? new Date().toISOString() : null,
    });
  }, [hydrated, step, profile, selectedLeadId, hasReplied, paywallSeen, engagementPoints]);

  const fullProfile = useMemo(() => effectiveProfile(profile), [profile]);
  const demoLeads = useMemo(() => {
    if (step < 4) return [];
    return buildDemoLeads(fullProfile);
  }, [fullProfile, step]);

  const selectedLead = useMemo(() => {
    if (!demoLeads.length) return null;
    return demoLeads.find((l) => l.id === selectedLeadId) ?? demoLeads[0];
  }, [demoLeads, selectedLeadId]);

  const [thread, setThread] = useState<DemoLead["messages"]>([]);

  useEffect(() => {
    if (selectedLead) setThread([...selectedLead.messages]);
  }, [selectedLead]);

  const go = useCallback(
    (next: OnboardingStep, label: string) => {
      setStep(next);
      trackOnboardingStep(next, label);
    },
    []
  );

  /* Activation simulation */
  useEffect(() => {
    if (step !== 3) return;
    setActivationLog([]);
    setActivationDone(false);
    const lines = [
      `→ Pairing ${fullProfile.city} territory…`,
      "→ Loading AI reply templates…",
      "→ Syncing SMS + portal handoffs…",
      "→ Subscribing to live lead stream…",
      "✓ Pipeline ready — demo leads incoming",
    ];
    let i = 0;
    const t = setInterval(() => {
      if (i < lines.length) {
        setActivationLog((prev) => [...prev, lines[i]]);
        i += 1;
      } else {
        clearInterval(t);
        setActivationDone(true);
      }
    }, 720);
    return () => clearInterval(t);
  }, [step, fullProfile.city]);

  useEffect(() => {
    if (step === 5 && demoLeads.length === 0) {
      setStep(4);
    }
  }, [step, demoLeads.length]);

  /* Fake incoming lead toasts on inbox / detail */
  useEffect(() => {
    if (step !== 4 && step !== 5) {
      if (incomingInterval.current) clearInterval(incomingInterval.current);
      return;
    }
    incomingInterval.current = setInterval(() => {
      toastId.current += 1;
      const id = toastId.current;
      const text = randomIncomingSnippet(fullProfile, id);
      setToasts((prev) => [...prev.slice(-3), { id, text }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5200);
    }, 13000);
    return () => {
      if (incomingInterval.current) clearInterval(incomingInterval.current);
    };
  }, [step, fullProfile]);

  const signupQuery = useMemo(() => {
    const q = new URLSearchParams();
    if (profile.fullName) q.set("fullName", profile.fullName.trim());
    if (profile.email) q.set("email", profile.email.trim());
    q.set("from", "onboarding");
    return q.toString();
  }, [profile.fullName, profile.email]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading…
      </div>
    );
  }

  /* ——— Step 1: Signup ——— */
  if (step === 1) {
    return (
      <Shell step={1}>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md sm:p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-300/90">LeadSmart AI</p>
          <h1 className="mt-2 font-heading text-2xl font-bold leading-tight sm:text-3xl">
            You&apos;re minutes from your first qualified leads
          </h1>
          <p className="mt-3 text-sm text-slate-300">
            No credit card. We&apos;ll personalize your demo pipeline, then show you real-style conversations.
          </p>
          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fullName = (profile.fullName ?? "").trim();
              const email = (profile.email ?? "").trim();
              if (!fullName || !email) return;
              setProfile((p) => ({ ...p, fullName, email }));
              go(2, "signup_complete");
            }}
          >
            <div>
              <label className="block text-xs font-semibold text-slate-300">Full name</label>
              <input
                name="fullName"
                value={profile.fullName ?? ""}
                onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))}
                required
                autoComplete="name"
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-slate-950/50 px-4 py-3 text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                placeholder="Jordan Martinez"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300">Work email</label>
              <input
                name="email"
                type="email"
                value={profile.email ?? ""}
                onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                required
                autoComplete="email"
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-slate-950/50 px-4 py-3 text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                placeholder="you@brokerage.com"
              />
            </div>
            <button
              type="submit"
              className="onboarding-pulse-cta mt-2 w-full rounded-xl bg-[#0072ce] py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-950/40 transition hover:bg-[#005ca8]"
            >
              Continue →
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-slate-500">
            Already have an account?{" "}
            <Link href="/login?redirect=/dashboard" className="font-semibold text-sky-400 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </Shell>
    );
  }

  /* ——— Step 2: Quick setup ——— */
  if (step === 2) {
    return (
      <Shell step={2}>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md sm:p-8">
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">Quick setup</h1>
          <p className="mt-2 text-sm text-slate-300">We&apos;ll tune the demo to your market and price band.</p>
          <form
            className="mt-8 space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const city = String(fd.get("city") ?? "").trim();
              const focus = fd.get("focus") as LeadFocus;
              const priceRangeId = fd.get("priceRangeId") as PriceRangeId;
              if (!city) return;
              setProfile((p) => ({ ...p, city, focus, priceRangeId }));
              go(3, "setup_complete");
            }}
          >
            <div>
              <label className="block text-xs font-semibold text-slate-300">Primary city / farm area</label>
              <input
                name="city"
                defaultValue={profile.city ?? ""}
                required
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-slate-950/50 px-4 py-3 text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                placeholder="e.g. Austin, TX"
              />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-300">Pipeline focus</span>
              <div className="mt-2 grid gap-2">
                {FOCUS_OPTIONS.map((o) => (
                  <label
                    key={o.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-slate-950/30 p-3 has-[:checked]:border-sky-500/60 has-[:checked]:bg-sky-500/10"
                  >
                    <input
                      type="radio"
                      name="focus"
                      value={o.id}
                      defaultChecked={(profile.focus ?? "both") === o.id}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-semibold">{o.label}</span>
                      <span className="text-xs text-slate-400">{o.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-300">Typical deal size</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRICE_OPTIONS.map((o) => (
                  <label key={o.id} className="cursor-pointer">
                    <input
                      type="radio"
                      name="priceRangeId"
                      value={o.id}
                      defaultChecked={(profile.priceRangeId ?? "750-1500") === o.id}
                      className="peer sr-only"
                    />
                    <span className="inline-flex rounded-full border border-white/15 bg-slate-950/40 px-4 py-2 text-xs font-semibold peer-checked:border-sky-500 peer-checked:bg-sky-500/20 peer-checked:text-white">
                      {o.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => go(1, "back")}
                className="rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/5"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-[#0072ce] py-3.5 text-sm font-bold text-white shadow-lg hover:bg-[#005ca8]"
              >
                Activate my pipeline →
              </button>
            </div>
          </form>
        </div>
      </Shell>
    );
  }

  /* ——— Step 3: Activation ——— */
  if (step === 3) {
    return (
      <Shell step={3}>
        <div className="rounded-2xl border border-emerald-500/20 bg-slate-950/80 p-6 font-mono text-sm shadow-xl backdrop-blur-md sm:p-8">
          <div className="mb-4 flex items-center gap-2 text-emerald-400">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wide">Live system simulation</span>
          </div>
          <h1 className="font-heading text-xl font-bold text-white sm:text-2xl">
            Turning on your AI lead desk…
          </h1>
          <ul className="mt-6 min-h-[180px] space-y-2 text-xs text-slate-300 sm:text-sm">
            {activationLog.map((line, idx) => (
              <li key={`${idx}-${line}`} className="onboarding-fade-up border-l-2 border-sky-500/40 pl-3">
                {line}
              </li>
            ))}
          </ul>
          {activationDone ? (
            <button
              type="button"
              onClick={() => {
                setSelectedLeadId(null);
                go(4, "activation_done");
              }}
              className="mt-6 w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white hover:bg-emerald-500"
            >
              Open my inbox →
            </button>
          ) : (
            <p className="mt-6 text-xs text-slate-500">Secure handshake with LeadSmart routing…</p>
          )}
        </div>
      </Shell>
    );
  }

  /* ——— Step 4: Demo leads inbox ——— */
  if (step === 4) {
    return (
      <Shell step={4}>
        <div className="relative">
          <div className="pointer-events-none fixed right-3 top-20 z-[80] flex max-w-[min(100%,320px)] flex-col gap-2 sm:right-6">
            {toasts.map((t) => (
              <div
                key={t.id}
                className="onboarding-toast-in pointer-events-auto rounded-xl border border-amber-500/40 bg-amber-950/95 px-4 py-3 text-xs font-semibold text-amber-100 shadow-lg backdrop-blur-md"
              >
                <span className="text-amber-400">Incoming · </span>
                {t.text}
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur-md sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <h1 className="font-heading text-xl font-bold sm:text-2xl">New leads</h1>
              <span className="rounded-full bg-rose-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-200">
                {demoLeads.length} waiting
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">Tap one to respond — speed wins listings.</p>
            <ul className="mt-6 space-y-3">
              {demoLeads.map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLeadId(lead.id);
                      setEngagementPoints((n) => n + 1);
                      go(5, "lead_open");
                    }}
                    className="flex w-full items-start gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-4 text-left transition hover:border-sky-500/40 hover:bg-sky-500/5"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-[#0072ce] text-sm font-bold text-white">
                      {lead.initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white">{lead.name}</span>
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-200">
                          {lead.intent}
                        </span>
                        <span className="text-[10px] text-slate-500">{lead.channel}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{lead.snippet}</p>
                      <p className="mt-1 text-[11px] font-medium text-amber-200/90">
                        ⏱ First response wins · waiting {lead.waitingSinceMin}m
                      </p>
                    </div>
                    <span className="text-sky-400">→</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Shell>
    );
  }

  /* ——— Step 5: Interaction ——— */
  if (step === 5 && selectedLead) {
    const lead = selectedLead;
    return (
      <Shell step={5}>
        <div className="relative">
          <div className="pointer-events-none fixed right-3 top-20 z-[80] flex max-w-[min(100%,320px)] flex-col gap-2 sm:right-6">
            {toasts.map((t) => (
              <div
                key={t.id}
                className="onboarding-toast-in pointer-events-auto rounded-xl border border-amber-500/40 bg-amber-950/95 px-4 py-3 text-xs font-semibold text-amber-100 shadow-lg"
              >
                <span className="text-amber-400">Incoming · </span>
                {t.text}
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 shadow-xl backdrop-blur-md">
            <div className="border-b border-white/10 p-4 sm:p-5">
              <button
                type="button"
                onClick={() => go(4, "back_inbox")}
                className="text-xs font-semibold text-sky-400 hover:underline"
              >
                ← Inbox
              </button>
              <div className="mt-3 flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-[#0072ce] text-base font-bold">
                  {lead.initials}
                </span>
                <div>
                  <h1 className="font-heading text-lg font-bold">{lead.name}</h1>
                  <p className="text-xs text-slate-400">
                    {lead.intent} · {lead.budget} · {lead.area}
                  </p>
                </div>
                <span className="ml-auto rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-bold text-emerald-200">
                  Score {lead.score}
                </span>
              </div>
            </div>
            <div className="max-h-[min(52vh,420px)] space-y-3 overflow-y-auto p-4 sm:p-5">
              {thread.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.from === "agent" ? "justify-end" : "justify-start"} onboarding-fade-up`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      m.from === "agent"
                        ? "bg-[#0072ce] text-white"
                        : "border border-white/10 bg-slate-900/80 text-slate-100"
                    }`}
                  >
                    {m.text}
                    <div className="mt-1 text-[10px] opacity-70">{m.at}</div>
                  </div>
                </div>
              ))}
            </div>
            <form
              className="border-t border-white/10 p-4 sm:p-5"
              onSubmit={(e) => {
                e.preventDefault();
                const text = replyDraft.trim();
                if (!text) return;
                setThread((prev) => [
                  ...prev,
                  {
                    id: `a-${Date.now()}`,
                    from: "agent",
                    text,
                    at: "Sent",
                  },
                ]);
                setReplyDraft("");
                setHasReplied(true);
                setEngagementPoints((n) => n + 2);
                setTimeout(() => {
                  setPaywallSeen(true);
                  go(6, "paywall_trigger");
                }, 650);
              }}
            >
              <label className="sr-only">Reply</label>
              <textarea
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                rows={2}
                placeholder="Write a fast reply… (demo)"
                className="w-full resize-none rounded-xl border border-white/15 bg-slate-950/50 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              />
              <button
                type="submit"
                className="mt-3 w-full rounded-xl bg-[#0072ce] py-3 text-sm font-bold text-white hover:bg-[#005ca8]"
              >
                Send reply →
              </button>
              <p className="mt-2 text-center text-[11px] text-slate-500">
                AI can draft follow-ups on Pro — unlock after upgrade.
              </p>
            </form>
          </div>
        </div>
      </Shell>
    );
  }

  /* ——— Step 6: Paywall trigger ——— */
  if (step === 6) {
    return (
      <Shell step={6}>
        <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-b from-rose-950/80 to-slate-950/90 p-6 shadow-2xl sm:p-8">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-rose-300">Leads are waiting</p>
          <h1 className="mt-3 text-center font-heading text-2xl font-bold leading-tight sm:text-3xl">
            2 more conversations are queued in your territory
          </h1>
          <p className="mx-auto mt-4 max-w-md text-center text-sm text-rose-100/90">
            You just proved response speed. Premium agents get full CRM, AI follow-ups, and unlimited lead routing —
            so none of these slip while you&apos;re in appointments.
          </p>
          <div className="mx-auto mt-8 max-w-sm rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-slate-200">
            <p className="font-semibold text-white">What you unlocked in this preview</p>
            <ul className="mt-3 space-y-2 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <BrandCheck tone="primary" />
                <span>Realistic lead profiles matched to {fullProfile.city}</span>
              </li>
              <li className="flex items-start gap-2">
                <BrandCheck tone="success" />
                <span>Inbox + thread view (what you&apos;ll use daily)</span>
              </li>
              <li className="flex items-start gap-2">
                <BrandCheck tone="accent" />
                <span>Simulated live “incoming lead” stream</span>
              </li>
            </ul>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => go(7, "to_pricing_embed")}
              className="onboarding-pulse-cta rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-rose-950 shadow-lg hover:bg-rose-50"
            >
              Compare plans & unlock →
            </button>
            <Link
              href={`/agent/pricing?from=onboarding&email=${encodeURIComponent(fullProfile.email)}`}
              className="rounded-xl border border-white/25 px-6 py-3.5 text-center text-sm font-semibold text-white hover:bg-white/5"
            >
              Open full pricing page
            </Link>
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">
            Engagement score: {engagementPoints} pts ·{" "}
            {hasReplied ? "High intent — you replied in-session" : "Preview mode"}
          </p>
        </div>
      </Shell>
    );
  }

  /* ——— Step 7: Pricing (embedded summary) ——— */
  if (step === 7) {
    const plans = [
      { name: "Free", price: "$0", note: "Test core workflows", cta: "Start free trial", href: "/agent/pricing?from=onboarding", primary: false },
      { name: "Pro", price: "$49/mo", note: "500 leads · full CRM", cta: "Upgrade Pro", href: "/agent/pricing?from=onboarding#plans", primary: true },
      { name: "Premium", price: "$99/mo", note: "Teams · unlimited scale", cta: "Go Premium", href: "/agent/pricing?from=onboarding#plans", primary: false },
    ];
    return (
      <Shell step={7}>
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="font-heading text-2xl font-bold sm:text-3xl">Choose how you scale</h1>
            <p className="mt-2 text-sm text-slate-400">Same checkout as the main app — trials available on the pricing page.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl border p-5 ${
                  p.primary ? "border-sky-500/50 bg-sky-500/10 shadow-lg shadow-sky-900/20" : "border-white/10 bg-white/5"
                }`}
              >
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{p.name}</p>
                <p className="mt-2 text-2xl font-bold text-white">{p.price}</p>
                <p className="mt-1 text-xs text-slate-400">{p.note}</p>
                <Link
                  href={p.href}
                  className={`mt-5 block w-full rounded-xl py-3 text-center text-sm font-bold ${
                    p.primary ? "bg-[#0072ce] text-white hover:bg-[#005ca8]" : "border border-white/20 text-white hover:bg-white/5"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(8, "upgrade_flow")}
            className="w-full rounded-xl border border-dashed border-white/20 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5"
          >
            I&apos;m ready — create my agent account →
          </button>
        </div>
      </Shell>
    );
  }

  /* ——— Step 8: Upgrade / account ——— */
  if (step === 8) {
    return (
      <Shell step={8}>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center shadow-xl backdrop-blur-md sm:p-10">
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">Finish setup in the real app</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-300">
            Create your agent profile (phone + password), then start your trial or upgrade from pricing. Your preview
            preferences aren&apos;t lost — we passed your email to signup.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:mx-auto sm:max-w-md">
            <Link
              href={`/agent-signup?${signupQuery}`}
              className="rounded-xl bg-[#0072ce] py-3.5 text-sm font-bold text-white shadow-lg hover:bg-[#005ca8]"
            >
              Create agent account
            </Link>
            <Link
              href="/agent/pricing?from=onboarding#plans"
              className="rounded-xl border border-white/20 py-3.5 text-sm font-semibold text-white hover:bg-white/5"
            >
              Stripe checkout · View plans
            </Link>
            <Link href="/login?redirect=/dashboard" className="text-sm font-semibold text-sky-400 hover:underline">
              Already registered? Log in
            </Link>
          </div>
          <button
            type="button"
            onClick={() => {
              clearOnboarding();
              setStep(1);
              setProfile({});
              setSelectedLeadId(null);
              setHasReplied(false);
              setPaywallSeen(false);
              setEngagementPoints(0);
            }}
            className="mt-8 text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
          >
            Restart preview (clears saved progress)
          </button>
        </div>
      </Shell>
    );
  }

  /* Step 5 but leads not ready (e.g. refresh edge case) */
  if (step === 5 && !selectedLead) {
    return (
      <Shell step={5}>
        <p className="text-center text-slate-400">Loading conversation…</p>
      </Shell>
    );
  }

  return null;
}
