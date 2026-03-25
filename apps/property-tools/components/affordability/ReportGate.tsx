"use client";

import React from "react";

export function AffordabilityReportGate({
  open,
  form,
  onChange,
  onUnlock,
  loading,
}: {
  open: boolean;
  form: { name: string; email: string; phone: string };
  onChange: (patch: Partial<{ name: string; email: string; phone: string }>) => void;
  onUnlock: () => void;
  loading: boolean;
}) {
  if (!open) return null;

  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div>
          <div className="inline-flex rounded-full border bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
            Unlock Full Buying Plan
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">
            Get Your Personalized Affordability Report
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-600 md:text-base">
            Unlock your full report and connect with an agent or lender for the next step.
          </p>
        </div>

        <div className="rounded-2xl border bg-gray-50 p-5">
          <div className="grid gap-3">
            <input value={form.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Name" className="w-full rounded-xl border bg-white px-4 py-3 text-sm" />
            <input value={form.email} onChange={(e) => onChange({ email: e.target.value })} placeholder="Email" className="w-full rounded-xl border bg-white px-4 py-3 text-sm" />
            <input value={form.phone} onChange={(e) => onChange({ phone: e.target.value })} placeholder="Phone (optional)" className="w-full rounded-xl border bg-white px-4 py-3 text-sm" />
            <button onClick={onUnlock} disabled={!form.name || !form.email || loading} className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-medium text-white disabled:bg-gray-300">
              {loading ? "Unlocking..." : "Unlock Report"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
