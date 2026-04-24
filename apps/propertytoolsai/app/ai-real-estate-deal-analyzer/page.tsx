"use client";

import AddressAutocomplete from "@/components/AddressAutocomplete";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ToolLeadGate } from "@/components/ToolLeadGate";
import { SaveResultsButton } from "@/components/SaveResultsButton";
import { buildSensitivityTables } from "@/lib/aiDealAnalyzer/sensitivity";
import type { DealCommentary } from "@/lib/aiDealAnalyzer/types";

type Inputs = {
  address: string;
  purchasePrice: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  yearBuilt: number | undefined;

  downPaymentPercent: number;
  interestRate: number;
  loanTermYears: number;

  monthlyRent: number;
  otherIncome: number;

  propertyTaxPercent: number;
  insuranceMonthly: number;
  maintenancePercent: number;
  managementPercent: number;
  vacancyPercent: number;
};

type CalculatedResults = {
  loanAmount: number;
  monthlyMortgage: number;
  grossMonthlyIncome: number;
  effectiveMonthlyIncome: number;
  operatingExpensesMonthly: number;
  totalMonthlyExpenses: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  annualNOI: number;
  capRate: number;
  cashOnCashReturn: number;
  cashInvested: number;
  priceToRentRatio: number;
};

function AiRealEstateDealAnalyzerPageInner() {
  const [inputs, setInputs] = useState<Inputs>({
    address: "",
    purchasePrice: 350_000,
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1_500,
    yearBuilt: 1995,

    downPaymentPercent: 20,
    interestRate: 6.5,
    loanTermYears: 30,

    monthlyRent: 2_500,
    otherIncome: 0,

    propertyTaxPercent: 1.2,
    insuranceMonthly: 150,
    maintenancePercent: 8,
    managementPercent: 8,
    vacancyPercent: 5,
  });

  const handleChange =
    <K extends keyof Inputs>(key: K) =>
    (value: number | string) => {
      setInputs((prev) => ({
        ...prev,
        [key]:
          typeof prev[key] === "number"
            ? Number(value) || 0
            : (value as string),
      }));
    };

  const handleReset = () => {
    setInputs({
      address: "",
      purchasePrice: 350_000,
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1_500,
      yearBuilt: 1995,

      downPaymentPercent: 20,
      interestRate: 6.5,
      loanTermYears: 30,

      monthlyRent: 2_500,
      otherIncome: 0,

      propertyTaxPercent: 1.2,
      insuranceMonthly: 150,
      maintenancePercent: 8,
      managementPercent: 8,
      vacancyPercent: 5,
    });
  };

  const results: CalculatedResults = useMemo(() => {
    const {
      purchasePrice,
      downPaymentPercent,
      interestRate,
      loanTermYears,
      monthlyRent,
      otherIncome,
      propertyTaxPercent,
      insuranceMonthly,
      maintenancePercent,
      managementPercent,
      vacancyPercent,
    } = inputs;

    const downPayment = (purchasePrice * downPaymentPercent) / 100;
    const loanAmount = Math.max(purchasePrice - downPayment, 0);

    const monthlyInterestRate =
      interestRate > 0 ? interestRate / 100 / 12 : 0;
    const numberOfPayments = loanTermYears * 12;

    const monthlyMortgage =
      loanAmount > 0 && monthlyInterestRate > 0
        ? (loanAmount *
            monthlyInterestRate *
            Math.pow(1 + monthlyInterestRate, numberOfPayments)) /
          (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1)
        : loanAmount > 0 && numberOfPayments > 0
        ? loanAmount / numberOfPayments
        : 0;

    const grossMonthlyIncome = monthlyRent + otherIncome;
    const monthlyVacancyLoss =
      (grossMonthlyIncome * vacancyPercent) / 100;
    const effectiveMonthlyIncome =
      grossMonthlyIncome - monthlyVacancyLoss;

    const propertyTaxMonthly =
      (purchasePrice * propertyTaxPercent) / 100 / 12;
    const maintenanceMonthly =
      grossMonthlyIncome * (maintenancePercent / 100);
    const managementMonthly =
      grossMonthlyIncome * (managementPercent / 100);

    const operatingExpensesMonthly =
      propertyTaxMonthly +
      insuranceMonthly +
      maintenanceMonthly +
      managementMonthly;

    const monthlyNOI = effectiveMonthlyIncome - operatingExpensesMonthly;
    const annualNOI = monthlyNOI * 12;

    const monthlyCashFlow =
      effectiveMonthlyIncome -
      operatingExpensesMonthly -
      monthlyMortgage;
    const annualCashFlow = monthlyCashFlow * 12;

    const cashInvested = downPayment;
    const cashOnCashReturn =
      cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : 0;

    const capRate =
      purchasePrice > 0 ? (annualNOI / purchasePrice) * 100 : 0;

    const priceToRentRatio =
      monthlyRent > 0
        ? purchasePrice / (monthlyRent * 12)
        : 0;

    return {
      loanAmount,
      monthlyMortgage,
      grossMonthlyIncome,
      effectiveMonthlyIncome,
      operatingExpensesMonthly,
      totalMonthlyExpenses: operatingExpensesMonthly + monthlyMortgage,
      monthlyCashFlow,
      annualCashFlow,
      annualNOI,
      capRate,
      cashOnCashReturn,
      cashInvested,
      priceToRentRatio,
    };
  }, [inputs]);

  // ── AI commentary ──────────────────────────────────────────────
  // Debounce the Claude call by 1.2s of input idle time. Every call
  // costs tokens; we don't want a user typing in the rent field to
  // fire 10 requests. The fallback path is fast and deterministic
  // so the UI has something to show while the AI call is in flight.
  const [commentary, setCommentary] = useState<DealCommentary | null>(null);
  const [commentaryLoading, setCommentaryLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const fetchCommentary = useCallback(async () => {
    const myRequestId = ++requestIdRef.current;
    setCommentaryLoading(true);
    try {
      const res = await fetch("/api/ai-deal-analyzer/commentary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inputs: {
            propertyAddress: inputs.address || null,
            purchasePrice: inputs.purchasePrice,
            bedrooms: inputs.bedrooms,
            bathrooms: inputs.bathrooms,
            squareFeet: inputs.squareFeet,
            yearBuilt: inputs.yearBuilt,
            downPaymentPercent: inputs.downPaymentPercent,
            interestRate: inputs.interestRate,
            loanTermYears: inputs.loanTermYears,
            monthlyRent: inputs.monthlyRent,
            otherIncome: inputs.otherIncome,
            propertyTaxPercent: inputs.propertyTaxPercent,
            insuranceMonthly: inputs.insuranceMonthly,
            maintenancePercent: inputs.maintenancePercent,
            managementPercent: inputs.managementPercent,
            vacancyPercent: inputs.vacancyPercent,
          },
          metrics: results,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        commentary?: DealCommentary;
      } | null;
      if (myRequestId !== requestIdRef.current) return; // stale
      if (body?.ok && body.commentary) setCommentary(body.commentary);
    } catch {
      /* swallow — commentary panel handles the null case */
    } finally {
      if (myRequestId === requestIdRef.current) setCommentaryLoading(false);
    }
  }, [inputs, results]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void fetchCommentary(), 1200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchCommentary]);

  // ── Sensitivity (pure math, no I/O) ────────────────────────────
  const sensitivity = useMemo(
    () =>
      buildSensitivityTables({
        propertyAddress: inputs.address || null,
        purchasePrice: inputs.purchasePrice,
        downPaymentPercent: inputs.downPaymentPercent,
        interestRate: inputs.interestRate,
        loanTermYears: inputs.loanTermYears,
        monthlyRent: inputs.monthlyRent,
        otherIncome: inputs.otherIncome,
        propertyTaxPercent: inputs.propertyTaxPercent,
        insuranceMonthly: inputs.insuranceMonthly,
        maintenancePercent: inputs.maintenancePercent,
        managementPercent: inputs.managementPercent,
        vacancyPercent: inputs.vacancyPercent,
      }),
    [inputs],
  );

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [specialistBooked, setSpecialistBooked] = useState(false);
  async function onDownloadPdf() {
    if (!commentary) return;
    setDownloadingPdf(true);
    try {
      const { buildDealAnalyzerPdf } = await import("@/lib/aiDealAnalyzer/buildPdf");
      const doc = buildDealAnalyzerPdf({
        inputs: {
          propertyAddress: inputs.address || null,
          purchasePrice: inputs.purchasePrice,
          bedrooms: inputs.bedrooms,
          bathrooms: inputs.bathrooms,
          squareFeet: inputs.squareFeet,
          yearBuilt: inputs.yearBuilt,
          downPaymentPercent: inputs.downPaymentPercent,
          interestRate: inputs.interestRate,
          loanTermYears: inputs.loanTermYears,
          monthlyRent: inputs.monthlyRent,
          otherIncome: inputs.otherIncome,
          propertyTaxPercent: inputs.propertyTaxPercent,
          insuranceMonthly: inputs.insuranceMonthly,
          maintenancePercent: inputs.maintenancePercent,
          managementPercent: inputs.managementPercent,
          vacancyPercent: inputs.vacancyPercent,
        },
        metrics: results,
        commentary,
        sensitivity,
      });
      const fileBase = (inputs.address || "deal-analysis")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
      doc.save(`${fileBase || "deal-analysis"}-report.pdf`);
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div className="w-full max-w-6xl py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-blue-600 text-sm font-medium mb-6"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Home
      </Link>

      <h1 className="text-3xl font-bold text-blue-600 mb-2">
        AI Real Estate Deal Analyzer
      </h1>
      <p className="text-gray-600 mb-8 max-w-3xl">
        Model a rental deal, then see an AI-written strategic read, stress-test
        the numbers with sensitivity scenarios, and download a branded PDF
        report.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <InputForm
          inputs={inputs}
          onChange={handleChange}
          onAnalyze={() => {
            /* results already track `inputs`; button is UX-only */
          }}
          onReset={handleReset}
        />

        <div className="space-y-6">
          <ResultsPanel inputs={inputs} results={results} />
          <AIDealCommentaryPanel
            commentary={commentary}
            loading={commentaryLoading}
          />
        </div>
      </div>

      <div className="mt-8">
        <SensitivitySection sensitivity={sensitivity} />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void onDownloadPdf()}
          disabled={!commentary || downloadingPdf}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m-9 9h12a2 2 0 002-2V6a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          {downloadingPdf ? "Generating…" : "Download PDF report"}
        </button>
      </div>

      <div className="mt-6">
        <SaveResultsButton
          tool="ai_deal_analyzer"
          inputs={inputs}
          results={results as unknown as Record<string, unknown>}
          propertyAddress={inputs.address || null}
        />
      </div>

      {specialistBooked ? (
        <div className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="flex items-start gap-3">
            <span className="text-lg">✅</span>
            <div>
              <div className="font-semibold">Request received</div>
              <p className="mt-1 text-emerald-800">
                An investment specialist familiar with rentals like
                {inputs.address ? ` ${inputs.address}` : " this one"} will
                reach out within 24 hours. They&apos;ll have your deal
                analysis on hand — no need to re-explain.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <ToolLeadGate
            tool="ai_deal_analyzer"
            source="ai_real_estate_deal_analyzer"
            intent="invest"
            propertyAddress={inputs.address || undefined}
            show={results.capRate > 0 || results.monthlyCashFlow !== 0}
            title="Talk to an investment specialist about this deal"
            description="Get a 20-minute call with a local investor-focused agent. They'll walk your numbers, flag anything the AI missed, and tell you what comparable deals are closing for."
            benefits={[
              "20-min call with a local investor-focused agent",
              "They already have your AI analysis — no re-explaining",
              "Free — you only pay if you hire them",
              "Usually reach out within 24 hours",
            ]}
            onUnlocked={() => setSpecialistBooked(true)}
          />
        </div>
      )}
    </div>
  );
}

type InputFormProps = {
  inputs: Inputs;
  onChange: <K extends keyof Inputs>(
    key: K
  ) => (value: string | number) => void;
  onAnalyze: () => void;
  onReset: () => void;
};

function InputForm({
  inputs,
  onChange,
  onAnalyze,
  onReset,
}: InputFormProps) {
  return (
    <div className="space-y-6">
      {/* Property Address */}
      <div className="bg-white shadow-md rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Property Address
        </h2>
        <div className="space-y-3">
          <AddressAutocomplete
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="123 Main St Los Angeles CA"
            value={inputs.address}
            onChange={(next) => onChange("address")(next)}
          />
          <button
            type="button"
            onClick={onAnalyze}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          >
            Analyze Property
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Address lookup will be enabled in a future update. For now, this
          field is stored in your analysis only.
        </p>
      </div>

      {/* Property Details */}
      <div className="bg-white shadow-md rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Property Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LabeledNumberInput
            label="Purchase Price ($)"
            value={inputs.purchasePrice}
            onChange={onChange("purchasePrice")}
            min={0}
          />
          <LabeledNumberInput
            label="Bedrooms"
            value={inputs.bedrooms}
            onChange={onChange("bedrooms")}
            min={0}
          />
          <LabeledNumberInput
            label="Bathrooms"
            value={inputs.bathrooms}
            onChange={onChange("bathrooms")}
            min={0}
            step={0.5}
          />
          <LabeledNumberInput
            label="Square Feet"
            value={inputs.squareFeet}
            onChange={onChange("squareFeet")}
            min={0}
          />
          <LabeledNumberInput
            label="Year Built"
            value={inputs.yearBuilt ?? ""}
            onChange={onChange("yearBuilt")}
            min={1800}
          />
        </div>
      </div>

      {/* Financing */}
      <div className="bg-white shadow-md rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Financing
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <LabeledNumberInput
            label="Down Payment (%)"
            value={inputs.downPaymentPercent}
            onChange={onChange("downPaymentPercent")}
            min={0}
            max={100}
          />
          <LabeledNumberInput
            label="Interest Rate (%)"
            value={inputs.interestRate}
            onChange={onChange("interestRate")}
            min={0}
            max={20}
            step={0.1}
          />
          <LabeledNumberInput
            label="Loan Term (years)"
            value={inputs.loanTermYears}
            onChange={onChange("loanTermYears")}
            min={5}
            max={40}
          />
        </div>
      </div>

      {/* Rental Income */}
      <div className="bg-white shadow-md rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Rental Income
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LabeledNumberInput
            label="Monthly Rent ($)"
            value={inputs.monthlyRent}
            onChange={onChange("monthlyRent")}
            min={0}
          />
          <LabeledNumberInput
            label="Other Monthly Income ($)"
            value={inputs.otherIncome}
            onChange={onChange("otherIncome")}
            min={0}
          />
        </div>
      </div>

      {/* Operating Expenses */}
      <div className="bg-white shadow-md rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Operating Expenses
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LabeledNumberInput
            label="Property Tax (%)"
            value={inputs.propertyTaxPercent}
            onChange={onChange("propertyTaxPercent")}
            min={0}
            step={0.1}
          />
          <LabeledNumberInput
            label="Insurance (monthly $)"
            value={inputs.insuranceMonthly}
            onChange={onChange("insuranceMonthly")}
            min={0}
          />
          <LabeledNumberInput
            label="Maintenance (%)"
            value={inputs.maintenancePercent}
            onChange={onChange("maintenancePercent")}
            min={0}
            max={30}
          />
          <LabeledNumberInput
            label="Property Management (%)"
            value={inputs.managementPercent}
            onChange={onChange("managementPercent")}
            min={0}
            max={30}
          />
          <LabeledNumberInput
            label="Vacancy (%)"
            value={inputs.vacancyPercent}
            onChange={onChange("vacancyPercent")}
            min={0}
            max={30}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onAnalyze}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        >
          Analyze Deal
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Reset Inputs
        </button>
        <button
          type="button"
          onClick={() => {
            alert(
              "Share functionality coming soon. For now, copy the URL or screenshot this analysis."
            );
          }}
          className="inline-flex items-center justify-center rounded-md border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
        >
          Share This Analysis
        </button>
      </div>
    </div>
  );
}

type ResultsPanelProps = {
  inputs: Inputs;
  results: CalculatedResults;
};

function ResultsPanel({ inputs, results }: ResultsPanelProps) {
  const {
    monthlyMortgage,
    totalMonthlyExpenses,
    monthlyCashFlow,
    capRate,
    cashOnCashReturn,
    priceToRentRatio,
  } = results;

  return (
    <div className="bg-white shadow-md rounded-lg p-6 space-y-5">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">
        Deal Results
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard
          label="Monthly Mortgage Payment"
          value={
            isFinite(monthlyMortgage)
              ? `$${monthlyMortgage.toFixed(0)}`
              : "$0"
          }
        />
        <MetricCard
          label="Total Monthly Expenses"
          value={`$${totalMonthlyExpenses.toFixed(0)}`}
          hint="Includes operating expenses and mortgage."
        />
        <MetricCard
          label="Monthly Cash Flow"
          value={`$${monthlyCashFlow.toFixed(0)}`}
          highlight={
            monthlyCashFlow > 0
              ? "positive"
              : monthlyCashFlow < 0
              ? "negative"
              : "neutral"
          }
        />
        <MetricCard
          label="Cap Rate"
          value={`${capRate.toFixed(2)}%`}
        />
        <MetricCard
          label="Cash on Cash Return"
          value={
            isFinite(cashOnCashReturn)
              ? `${cashOnCashReturn.toFixed(2)}%`
              : "N/A"
          }
        />
        <MetricCard
          label="Price to Rent Ratio"
          value={
            isFinite(priceToRentRatio)
              ? priceToRentRatio.toFixed(1)
              : "N/A"
          }
          hint="Purchase price ÷ annual rent."
        />
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Calculations are based on your current assumptions for{" "}
        <span className="font-semibold">
          {inputs.address || "this property"}
        </span>
        . Adjust values on the left to see how the deal changes.
      </p>
    </div>
  );
}

/**
 * AI commentary panel — shows the deal score, headline, strengths,
 * risks, and suggested next moves. While Claude's response is in
 * flight we keep the previous commentary visible with a subtle
 * "updating…" badge so the panel doesn't flash empty on every
 * keystroke.
 */
function AIDealCommentaryPanel({
  commentary,
  loading,
}: {
  commentary: DealCommentary | null;
  loading: boolean;
}) {
  if (!commentary) {
    return (
      <div className="bg-white shadow-md rounded-lg p-6 text-sm text-gray-500">
        {loading
          ? "Analyzing this deal…"
          : "Enter your deal inputs to see the AI analysis."}
      </div>
    );
  }

  const score = commentary.dealScore;
  const scoreColor =
    score >= 70
      ? "bg-emerald-500"
      : score >= 50
        ? "bg-amber-500"
        : "bg-rose-500";

  return (
    <div className="bg-white shadow-md rounded-lg p-6 space-y-4 text-sm text-gray-700">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">
              AI deal analysis
            </h2>
            {loading ? (
              <span className="text-[11px] font-medium text-slate-400">
                updating…
              </span>
            ) : null}
            {!commentary.aiGenerated ? (
              <span
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                title="AI is temporarily unavailable; using rule-based fallback"
              >
                Offline mode
              </span>
            ) : null}
          </div>
          <p className="mt-1 font-medium text-slate-900">
            {commentary.headline}
          </p>
        </div>
        <div
          className={`flex h-16 w-16 flex-col items-center justify-center rounded-lg ${scoreColor} text-white`}
        >
          <div className="text-xl font-bold leading-none">{score}</div>
          <div className="text-[9px] uppercase tracking-wide opacity-90">score</div>
        </div>
      </div>

      <p className="text-slate-700 leading-relaxed">{commentary.summary}</p>

      {commentary.strengths.length ? (
        <div>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
            Strengths
          </h3>
          <ul className="space-y-1 text-slate-700">
            {commentary.strengths.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-emerald-600">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {commentary.risks.length ? (
        <div>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700">
            Risks
          </h3>
          <ul className="space-y-1 text-slate-700">
            {commentary.risks.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-rose-600">⚠</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {commentary.nextMoves.length ? (
        <div>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
            Next moves
          </h3>
          <ul className="space-y-1 text-slate-700">
            {commentary.nextMoves.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-blue-600">→</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-[11px] text-gray-400">
        {commentary.aiGenerated
          ? "Commentary generated by Claude based on your inputs. Not financial advice — verify with a local expert."
          : "Commentary generated from deterministic rules (AI temporarily unavailable)."}
      </p>
    </div>
  );
}

/**
 * Sensitivity analysis tables — stress-test the deal by seeing how
 * monthly cash flow / cap rate / CoC shift as rate, rent, and
 * vacancy move around their base assumptions. Pure client-side math.
 */
function SensitivitySection({
  sensitivity,
}: {
  sensitivity: ReturnType<typeof buildSensitivityTables>;
}) {
  return (
    <section className="bg-white shadow-md rounded-lg p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Sensitivity analysis
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            What happens to this deal if rates, rents, or vacancy move? One
            variable shifts at a time — everything else stays at your inputs.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {sensitivity.map((table) => (
          <div key={table.axis} className="rounded-lg border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
              {table.axisLabel}
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-1.5 font-medium">Scenario</th>
                  <th className="px-3 py-1.5 text-right font-medium">Cash / mo</th>
                  <th className="px-3 py-1.5 text-right font-medium">Cap</th>
                  <th className="px-3 py-1.5 text-right font-medium">CoC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {table.cells.map((cell, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-1.5 text-slate-700">{cell.label}</td>
                    <td
                      className={`px-3 py-1.5 text-right font-medium tabular-nums ${
                        cell.monthlyCashFlow >= 0
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }`}
                    >
                      ${Math.round(cell.monthlyCashFlow).toLocaleString()}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                      {cell.capRate.toFixed(1)}%
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                      {cell.cashOnCashReturn.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  );
}

type LabeledNumberInputProps = {
  label: string;
  value: number | string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
};

function LabeledNumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: LabeledNumberInputProps) {
  return (
    <label className="block text-sm">
      <span className="text-gray-700">{label}</span>
      <input
        type="number"
        className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  hint?: string;
  highlight?: "positive" | "negative" | "neutral";
};

function MetricCard({
  label,
  value,
  hint,
  highlight,
}: MetricCardProps) {
  const highlightClasses =
    highlight === "positive"
      ? "text-emerald-700"
      : highlight === "negative"
      ? "text-rose-700"
      : "text-gray-900";

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className={`mt-1 text-lg font-semibold ${highlightClasses}`}>
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-xs text-gray-500">
          {hint}
        </div>
      )}
    </div>
  );
}

export default function AiRealEstateDealAnalyzerPage() {
  return <AiRealEstateDealAnalyzerPageInner />;
}
