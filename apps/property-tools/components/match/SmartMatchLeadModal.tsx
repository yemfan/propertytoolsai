"use client";

import React from "react";

export function SmartMatchLeadModal({
  open,
  form,
  onChange,
  onSubmit,
  loading,
  error,
  onClose,
}: {
  open: boolean;
  form: { name: string; email: string; phone: string };
  onChange: (patch: Partial<{ name: string; email: string; phone: string }>) => void;
  onSubmit: () => void;
  loading: boolean;
  error?: string;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-3xl border bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-gray-900">
              Unlock Full Matches + Off-Market Deals
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Save your matches and get connected to an agent who can send more homes that fit your budget.
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-sm text-gray-500 hover:text-gray-800">
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          <input
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Name"
            className="rounded-xl border px-4 py-3 text-sm"
          />
          <input
            value={form.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="Email"
            type="email"
            className="rounded-xl border px-4 py-3 text-sm"
          />
          <input
            value={form.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="Phone (optional)"
            className="rounded-xl border px-4 py-3 text-sm"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!form.name.trim() || !form.email.trim() || loading}
            className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-medium text-white disabled:bg-gray-300"
          >
            {loading ? "Unlocking..." : "Unlock Full Matches"}
          </button>
        </div>
      </div>
    </div>
  );
}
