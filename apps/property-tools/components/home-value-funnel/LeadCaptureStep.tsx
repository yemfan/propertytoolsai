"use client";

import { useState } from "react";

type Props = {
  name: string;
  email: string;
  phone: string;
  onChange: (patch: Partial<{ name: string; email: string; phone: string }>) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
  error: string | null;
};

export default function LeadCaptureStep({ name, email, phone, onChange, onSubmit, onBack, loading, error }: Props) {
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">Where should we send your breakdown?</h2>
        <p className="mt-2 text-sm text-gray-600">
          We&apos;ll email your full adjustment breakdown and confidence factors. Phone is optional — only if you want
          follow-up about tools on this site.
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setLocalError(null);
          if (!name.trim()) {
            setLocalError("Please enter your name.");
            return;
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setLocalError("Please enter a valid email.");
            return;
          }
          onSubmit();
        }}
      >
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Name</span>
          <input
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#0072ce] focus:ring-2 focus:ring-[#0072ce]/25"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => onChange({ email: e.target.value })}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#0072ce] focus:ring-2 focus:ring-[#0072ce]/25"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Phone (optional)</span>
          <input
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#0072ce] focus:ring-2 focus:ring-[#0072ce]/25"
          />
        </label>

        {(localError || error) && (
          <p className="text-sm text-red-600" role="alert">
            {localError || error}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {loading ? "Saving…" : "Email my full breakdown"}
          </button>
        </div>
      </form>
    </div>
  );
}
