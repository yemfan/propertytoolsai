"use client";

import React from "react";
import type { BuyerIntentState } from "@/lib/affordability/types";

export function AffordabilityIntentPanel({
  value,
  onChange,
}: {
  value: BuyerIntentState;
  onChange: (patch: Partial<BuyerIntentState>) => void;
}) {
  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
          Personalize Your Buying Plan
        </h2>
        <p className="text-sm text-gray-600 md:text-base">
          Add a few intent details so we can tailor homes, lender options, and next steps.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Preferred City">
          <input
            value={value.preferredCity || ""}
            onChange={(e) => onChange({ preferredCity: e.target.value })}
            placeholder="e.g. Pasadena"
            className="w-full rounded-xl border px-4 py-3 text-sm"
          />
        </Field>

        <Field label="Preferred ZIP">
          <input
            value={value.preferredZip || ""}
            onChange={(e) => onChange({ preferredZip: e.target.value })}
            placeholder="e.g. 91101"
            className="w-full rounded-xl border px-4 py-3 text-sm"
          />
        </Field>

        <Field label="Property Type">
          <select
            value={value.preferredPropertyType || ""}
            onChange={(e) =>
              onChange({
                preferredPropertyType: e.target.value
                  ? (e.target.value as BuyerIntentState["preferredPropertyType"])
                  : undefined,
              })
            }
            className="w-full rounded-xl border px-4 py-3 text-sm"
          >
            <option value="">Select type</option>
            <option value="single_family">Single Family</option>
            <option value="condo">Condo</option>
            <option value="townhome">Townhome</option>
            <option value="multi_family">Multi Family</option>
          </select>
        </Field>

        <Field label="Timeline">
          <select
            value={value.timeline || ""}
            onChange={(e) =>
              onChange({
                timeline: e.target.value
                  ? (e.target.value as BuyerIntentState["timeline"])
                  : undefined,
              })
            }
            className="w-full rounded-xl border px-4 py-3 text-sm"
          >
            <option value="">Select timeline</option>
            <option value="now">Buying now</option>
            <option value="3_months">Within 3 months</option>
            <option value="6_months">Within 6 months</option>
            <option value="exploring">Just exploring</option>
          </select>
        </Field>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <ToggleCard
          label="First-time buyer"
          checked={!!value.firstTimeBuyer}
          onChange={(checked) => onChange({ firstTimeBuyer: checked })}
        />
        <ToggleCard
          label="Already pre-approved"
          checked={!!value.alreadyPreapproved}
          onChange={(checked) => onChange({ alreadyPreapproved: checked })}
        />
        <ToggleCard
          label="Veteran / VA eligible"
          checked={!!value.veteran}
          onChange={(checked) => onChange({ veteran: checked })}
        />
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm text-gray-600">{label}</label>
      {children}
    </div>
  );
}

function ToggleCard({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        "flex items-center justify-between rounded-2xl border px-4 py-4 text-left transition",
        checked ? "border-gray-900 bg-gray-900 text-white" : "bg-white hover:bg-gray-50",
      ].join(" ")}
    >
      <span className="text-sm font-medium">{label}</span>
      <span
        className={[
          "h-5 w-5 rounded-full border",
          checked ? "border-white bg-white" : "border-gray-300 bg-gray-100",
        ].join(" ")}
      />
    </button>
  );
}
