"use client";

import type { LeadForm } from "@/lib/home-value/types";

export function ReportGate({
  open,
  form,
  onFormChange,
  onUnlock,
  isBusy,
  error,
}: {
  open: boolean;
  form: LeadForm;
  onFormChange: (patch: Partial<LeadForm>) => void;
  onUnlock: () => void;
  isBusy: boolean;
  error?: string | null;
}) {
  if (!open) return null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <div className="inline-flex rounded-full border border-slate-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
            Unlock Full Report
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">
            Get the Detailed Valuation Report
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-600 md:text-base">
            Unlock the refined estimate, confidence explanation, market snapshot, and next-step recommendations.
          </p>

          <ul className="mt-5 space-y-2 text-sm text-gray-700">
            <li>• Full value range and confidence summary</li>
            <li>• Local market benchmark and comp signal</li>
            <li>• Suggested next steps for seller, buyer, or investor intent</li>
          </ul>
        </div>

        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-gray-50 p-5">
          <div className="grid gap-3">
            <div>
              <label className="mb-1 block text-sm text-gray-600">Name</label>
              <input
                value={form.name}
                onChange={(e) => onFormChange({ name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-gray-400"
                placeholder="Your name"
                autoComplete="name"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => onFormChange({ email: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-gray-400"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">Phone (optional)</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => onFormChange({ phone: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-gray-400"
                placeholder="(555) 555-5555"
                autoComplete="tel"
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <button
              type="button"
              onClick={onUnlock}
              disabled={!form.name.trim() || !form.email.trim() || isBusy}
              className="mt-2 rounded-2xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isBusy ? "Unlocking..." : "Unlock Full Report"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
