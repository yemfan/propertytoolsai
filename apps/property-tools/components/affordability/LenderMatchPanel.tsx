"use client";

import React, { useState } from "react";
import type { BuyerIntentState } from "@/lib/affordability/types";

function money(value?: number) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function LenderMatchPanel({
  maxHomePrice,
  monthlyBudget,
  intent,
  onSubmit,
}: {
  maxHomePrice: number;
  monthlyBudget: number;
  intent: BuyerIntentState;
  onSubmit?: (payload: { name: string; email: string; phone: string }) => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div>
          <div className="inline-flex rounded-full border bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
            Next Step
          </div>

          <h3 className="mt-4 text-2xl font-semibold tracking-tight text-gray-900">
            Get Pre-Approved
          </h3>

          <p className="mt-3 text-sm leading-relaxed text-gray-600 md:text-base">
            Based on your estimated buying power of {money(maxHomePrice)}, the next best step is to
            verify financing with a lender.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <SmallStat label="Estimated Buying Power" value={money(maxHomePrice)} />
            <SmallStat label="Monthly Housing Budget" value={money(monthlyBudget)} />
            <SmallStat
              label="Timeline"
              value={intent.timeline ? intent.timeline.replaceAll("_", " ") : "Not set"}
            />
            <SmallStat
              label="Loan Path"
              value={intent.alreadyPreapproved ? "Already pre-approved" : "Needs lender review"}
            />
          </div>
        </div>

        <div className="rounded-2xl border bg-gray-50 p-5">
          <div className="grid gap-3">
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-xl border bg-white px-4 py-3 text-sm"
            />
            <input
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full rounded-xl border bg-white px-4 py-3 text-sm"
            />
            <input
              placeholder="Phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              className="w-full rounded-xl border bg-white px-4 py-3 text-sm"
            />
            <button
              type="button"
              onClick={() => onSubmit?.(form)}
              disabled={!form.name.trim() || !form.email.trim()}
              className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Get Matched with a Lender
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-gray-50 p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}
