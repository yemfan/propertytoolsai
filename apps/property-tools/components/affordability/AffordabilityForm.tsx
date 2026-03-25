"use client";

import React from "react";
import type { AffordabilityInput } from "@/lib/affordability/types";

type FormState = Omit<AffordabilityInput, "sessionId">;

export function AffordabilityForm({
  value,
  onChange,
  onSubmit,
  loading,
}: {
  value: FormState;
  onChange: (patch: Partial<FormState>) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Annual Income">
          <input type="number" value={value.annualIncome || ""} onChange={(e) => onChange({ annualIncome: Number(e.target.value || 0) })} className="w-full rounded-xl border px-4 py-3 text-sm" />
        </Field>
        <Field label="Monthly Debts">
          <input type="number" value={value.monthlyDebts || ""} onChange={(e) => onChange({ monthlyDebts: Number(e.target.value || 0) })} className="w-full rounded-xl border px-4 py-3 text-sm" />
        </Field>
        <Field label="Down Payment">
          <input type="number" value={value.downPayment || ""} onChange={(e) => onChange({ downPayment: Number(e.target.value || 0) })} className="w-full rounded-xl border px-4 py-3 text-sm" />
        </Field>
        <Field label="Interest Rate %">
          <input type="number" step="0.01" value={value.interestRate || ""} onChange={(e) => onChange({ interestRate: Number(e.target.value || 0) })} className="w-full rounded-xl border px-4 py-3 text-sm" />
        </Field>
        <Field label="Loan Term (Years)">
          <select value={value.loanTermYears || 30} onChange={(e) => onChange({ loanTermYears: Number(e.target.value) })} className="w-full rounded-xl border px-4 py-3 text-sm">
            <option value={30}>30</option>
            <option value={20}>20</option>
            <option value={15}>15</option>
          </select>
        </Field>
        <Field label="Property Tax Rate">
          <input type="number" step="0.0001" value={value.propertyTaxRate || ""} onChange={(e) => onChange({ propertyTaxRate: Number(e.target.value || 0) })} className="w-full rounded-xl border px-4 py-3 text-sm" />
        </Field>
        <Field label="Annual Insurance">
          <input type="number" value={value.annualHomeInsurance || ""} onChange={(e) => onChange({ annualHomeInsurance: Number(e.target.value || 0) })} className="w-full rounded-xl border px-4 py-3 text-sm" />
        </Field>
        <Field label="Monthly HOA">
          <input type="number" value={value.monthlyHoa || ""} onChange={(e) => onChange({ monthlyHoa: Number(e.target.value || 0) })} className="w-full rounded-xl border px-4 py-3 text-sm" />
        </Field>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className="rounded-2xl bg-gray-900 px-6 py-3 text-sm font-medium text-white disabled:bg-gray-300"
        >
          {loading ? "Calculating..." : "Calculate Affordability"}
        </button>
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
