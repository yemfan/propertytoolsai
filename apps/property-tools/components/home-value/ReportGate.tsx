"use client";

import { useState } from "react";
import type { UnlockReportInput } from "@/lib/home-value/useHomeValueEstimate";

type Props = {
  expanded: boolean;
  onRequestOpen: () => void;
  onSubmit: (input: UnlockReportInput) => Promise<{ ok: boolean; error?: string }>;
  submitting: boolean;
  error?: string | null;
};

export function ReportGate({ expanded, onRequestOpen, onSubmit, submitting, error }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ name, email, phone });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 text-white shadow-2xl shadow-slate-900/20">
      <div className="relative px-6 py-8 md:px-10 md:py-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#0072ce]/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-white/5 blur-3xl" />

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Full report</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Unlock adjustment detail &amp; next steps</h3>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75">
            See how each factor influenced your range, confidence drivers, and comparable-sale context. Share your contact
            and we&apos;ll save this estimate to your lead profile for follow-up — no spam, unsubscribe anytime.
          </p>

          {!expanded ? (
            <div className="mt-8 space-y-4">
              <ul className="space-y-2 text-sm text-white/70">
                <li className="flex items-center gap-2">
                  <span className="text-[#0072ce]">✓</span> Line-by-line valuation adjustments
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#0072ce]">✓</span> What&apos;s driving confidence
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#0072ce]">✓</span> Personalized toolkit recommendations
                </li>
              </ul>
              <button
                type="button"
                onClick={onRequestOpen}
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-8 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-100"
              >
                Continue with email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 max-w-md space-y-4">
              <div>
                <label htmlFor="hv-lead-name" className="block text-xs font-medium text-white/70">
                  Full name
                </label>
                <input
                  id="hv-lead-name"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#0072ce] focus:ring-2 focus:ring-[#0072ce]/40"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label htmlFor="hv-lead-email" className="block text-xs font-medium text-white/70">
                  Email
                </label>
                <input
                  id="hv-lead-email"
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#0072ce] focus:ring-2 focus:ring-[#0072ce]/40"
                  placeholder="you@email.com"
                />
              </div>
              <div>
                <label htmlFor="hv-lead-phone" className="block text-xs font-medium text-white/70">
                  Phone <span className="font-normal text-white/45">(optional)</span>
                </label>
                <input
                  id="hv-lead-phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#0072ce] focus:ring-2 focus:ring-[#0072ce]/40"
                  placeholder="(555) 555-5555"
                />
              </div>
              {error ? <p className="text-sm text-amber-200">{error}</p> : null}
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#0072ce] px-8 text-sm font-semibold text-white shadow-lg shadow-[#0072ce]/30 transition hover:bg-[#0062b8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Unlocking…" : "Unlock full report"}
              </button>
              <p className="text-[0.65rem] leading-relaxed text-white/45">
                By continuing you agree we may contact you about this estimate. This is not an appraisal.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
