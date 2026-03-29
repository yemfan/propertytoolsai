"use client";

import React, { useEffect, useState } from "react";
import { AffordabilityHero } from "@/components/affordability/AffordabilityHero";
import { AffordabilityForm } from "@/components/affordability/AffordabilityForm";
import { AffordabilityReportV2 } from "@/components/affordability/AffordabilityReportV2";
import { AffordabilityReportGate } from "@/components/affordability/ReportGate";
import { BuyerActionPanel } from "@/components/affordability/BuyerActionPanel";
import type {
  AffordabilityInput,
  AffordabilityResult,
  BuyerIntentState,
  LoanProgram,
} from "@/lib/affordability/types";

function generateSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `aff_${Math.random().toString(36).slice(2, 11)}`;
}

export default function AffordabilityPage() {
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AffordabilityResult | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);

  const [form, setForm] = useState<Omit<AffordabilityInput, "sessionId">>({
    annualIncome: 180000,
    monthlyDebts: 1200,
    downPayment: 120000,
    downPaymentMode: "amount" as const,
    interestRate: 6.75,
    loanTermYears: 30,
    propertyTaxRate: 0.0125,
    annualHomeInsurance: 1800,
    monthlyHoa: 0,
    loanProgram: "conventional" as LoanProgram,
    creditScore: 720,
    zip: "91754",
    firstTimeBuyer: false,
  });

  const [leadForm, setLeadForm] = useState({ name: "", email: "", phone: "" });
  const [intent, setIntent] = useState<BuyerIntentState>({});
  const [lenderMatchSent, setLenderMatchSent] = useState(false);

  useEffect(() => {
    const existing = window.localStorage.getItem("affordability_session_id");
    const id = existing || generateSessionId();
    setSessionId(id);
    window.localStorage.setItem("affordability_session_id", id);
  }, []);

  async function calculate() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/affordability/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          ...form,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || "Calculation failed");
      setResult(json.result);
      setIntent((prev) => ({
        ...prev,
        preferredZip: prev.preferredZip || form.zip || undefined,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calculation failed");
    } finally {
      setLoading(false);
    }
  }

  async function unlock() {
    try {
      setUnlocking(true);
      setError("");

      const res = await fetch("/api/affordability/unlock-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          ...leadForm,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || "Unlock failed");
      setLeadId(json.leadId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <AffordabilityHero />

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <AffordabilityForm
          value={form}
          onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          onSubmit={() => void calculate()}
          loading={loading}
        />

        {result ? (
          <AffordabilityReportV2
            annualIncome={form.annualIncome}
            monthlyDebts={form.monthlyDebts}
            intent={intent}
            setIntent={setIntent}
            result={result}
            unlocked={!!leadId}
            onLenderMatch={
              leadId
                ? async (payload) => {
                    try {
                      const res = await fetch("/api/affordability/lender-match", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          sessionId,
                          name: payload.name,
                          email: payload.email,
                          phone: payload.phone,
                          preferredCity: intent.preferredCity,
                          preferredZip: intent.preferredZip,
                          preferredPropertyType: intent.preferredPropertyType,
                          timeline: intent.timeline,
                          firstTimeBuyer: intent.firstTimeBuyer,
                          alreadyPreapproved: intent.alreadyPreapproved,
                          veteran: intent.veteran,
                        }),
                      });
                      const json = await res.json();
                      if (!res.ok || !json?.success) throw new Error(json?.error || "Request failed");
                      setLenderMatchSent(true);
                    } catch {
                      setError("Could not submit lender match request. Try again.");
                    }
                  }
                : undefined
            }
          />
        ) : null}

        {leadId && lenderMatchSent ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Thanks — we received your lender match request.
          </div>
        ) : null}

        {result && !leadId ? (
          <AffordabilityReportGate
            open={true}
            form={leadForm}
            onChange={(patch) => setLeadForm((prev) => ({ ...prev, ...patch }))}
            onUnlock={() => void unlock()}
            loading={unlocking}
          />
        ) : null}

        {leadId ? <BuyerActionPanel /> : null}
      </div>
    </div>
  );
}
