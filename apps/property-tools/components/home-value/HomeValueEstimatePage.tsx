"use client";

/**
 * PropertyToolsAI — Home Value Estimate Page
 * UI structure matches the in-app spec (hero, card, refinement, gate, full report, next steps).
 * APIs (production):
 * - POST /api/home-value/estimate  (nested body)
 * - POST /api/home-value/unlock-report  ({ ok, leadId })
 * - GET  /api/home-value/session?session_id=...
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { mergeAuthHeaders } from "@/lib/mergeAuthHeaders";
import {
  computeEngagementScore,
  crmIntentFromLikelyIntent,
  HIGH_VALUE_PROPERTY_THRESHOLD_USD,
  leadScoreBand,
} from "@/lib/homeValue/engagementScore";
import { fetchJson } from "@/lib/homeValue/fetchJson";
import type { HomeValueEstimateResponse } from "@/lib/homeValue/types";
import HomeValueTrustDisclaimer from "@/components/home-value/HomeValueTrustDisclaimer";

const HV_SESSION_KEY = "propertytoolsai:hv_session_id";
const HV_UNLOCK_KEY = "propertytoolsai:hv_report_unlocked";
const HV_LEAD_ID_KEY = "propertytoolsai:hv_unlock_lead_id";
/** Legacy key — kept in sync for older bookmarks / experiments */
const LEGACY_SESSION_STORAGE_KEY = "home_value_session_id";

type PropertyCondition = "poor" | "fair" | "average" | "good" | "excellent";
type ConfidenceLabel = "low" | "medium" | "high";

type EstimateUiState =
  | "idle"
  | "address_selected"
  | "estimating"
  | "preview_ready"
  | "refining"
  | "report_locked"
  | "unlocking"
  | "report_unlocked"
  | "error";

type AddressSelection = {
  fullAddress: string;
  street?: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
};

type EstimateRequestDetails = {
  propertyType?: "single_family" | "condo" | "townhome" | "multi_family";
  beds?: number;
  baths?: number;
  sqft?: number;
  yearBuilt?: number;
  lotSize?: number;
  condition?: PropertyCondition;
  renovatedRecently?: boolean;
};

/** UI / spec shape — derived from {@link HomeValueEstimateResponse} */
type EstimateResponse = {
  success: true;
  sessionId: string;
  property: {
    fullAddress: string;
    city: string;
    state: string;
    zip: string;
    propertyType?: string;
    beds?: number;
    baths?: number;
    sqft?: number;
    yearBuilt?: number;
    lotSize?: number;
  };
  estimate: {
    value: number;
    rangeLow: number;
    rangeHigh: number;
    confidence: ConfidenceLabel;
    confidenceScore: number;
    summary: string;
  };
  supportingData: {
    medianPpsf: number;
    localTrendPct?: number;
    compCount?: number;
    avgDaysOnMarket?: number;
  };
  recommendations?: {
    type?: string;
    actions?: string[];
  };
};

/** Built client-side after unlock — unlock API does not return `report` */
type UnlockReportResponse = {
  success: true;
  leadId: string;
  report: {
    estimate: {
      value: number;
      rangeLow: number;
      rangeHigh: number;
      confidence: ConfidenceLabel;
      confidenceScore: number;
    };
    market?: {
      medianPpsf?: number;
      localTrendPct?: number;
      compCount?: number;
      city?: string;
    };
    recommendations?: {
      type?: string;
      actions?: string[];
    };
  };
};

function trendToLocalPct(t: "up" | "down" | "stable"): number {
  if (t === "up") return 0.03;
  if (t === "down") return -0.03;
  return 0;
}

function apiToEstimateResponse(r: HomeValueEstimateResponse): EstimateResponse {
  const p = r.normalizedProperty;
  const medianPpsf = r.market.pricePerSqft ?? r.estimate.baselinePpsf;
  return {
    success: true,
    sessionId: r.sessionId,
    property: {
      fullAddress: p.address,
      city: p.city ?? "",
      state: p.state ?? "",
      zip: p.zip ?? "",
      propertyType: p.propertyType ?? undefined,
      beds: p.beds ?? undefined,
      baths: p.baths ?? undefined,
      sqft: p.sqft ?? undefined,
      yearBuilt: p.yearBuilt ?? undefined,
      lotSize: p.lotSqft ?? undefined,
    },
    estimate: {
      value: r.estimate.point,
      rangeLow: r.estimate.low,
      rangeHigh: r.estimate.high,
      confidence: r.confidence.level as ConfidenceLabel,
      confidenceScore: r.confidence.score,
      summary: r.estimate.summary,
    },
    supportingData: {
      medianPpsf,
      localTrendPct: trendToLocalPct(r.market.trend),
      compCount: r.comps.pricedCount,
      avgDaysOnMarket: undefined,
    },
    recommendations: {
      type: r.intentInference.applied,
      actions: r.recommendations.map((x) => x.title),
    },
  };
}

function buildUnlockReportResponse(leadId: string, r: HomeValueEstimateResponse): UnlockReportResponse {
  const medianPpsf = r.market.pricePerSqft ?? r.estimate.baselinePpsf;
  return {
    success: true,
    leadId,
    report: {
      estimate: {
        value: r.estimate.point,
        rangeLow: r.estimate.low,
        rangeHigh: r.estimate.high,
        confidence: r.confidence.level as ConfidenceLabel,
        confidenceScore: r.confidence.score,
      },
      market: {
        medianPpsf,
        localTrendPct: trendToLocalPct(r.market.trend),
        compCount: r.comps.pricedCount,
        city: r.market.city,
      },
      recommendations: {
        type: r.intentInference.applied,
        actions: r.recommendations.map((x) => x.title),
      },
    },
  };
}

function generateSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `sess_${Math.random().toString(36).slice(2, 11)}`;
}

function persistSessionIdEverywhere(id: string) {
  try {
    sessionStorage.setItem(HV_SESSION_KEY, id);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(LEGACY_SESSION_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

function readOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(HV_SESSION_KEY);
    if (!id) {
      id = localStorage.getItem(LEGACY_SESSION_STORAGE_KEY);
    }
    if (!id) {
      id = generateSessionId();
    }
    persistSessionIdEverywhere(id);
    return id;
  } catch {
    return generateSessionId();
  }
}

function persistUnlocked(leadId?: string) {
  try {
    sessionStorage.setItem(HV_UNLOCK_KEY, "1");
    if (leadId && leadId !== "—") {
      sessionStorage.setItem(HV_LEAD_ID_KEY, leadId);
    }
  } catch {
    /* ignore */
  }
}

function readStoredLeadId(): string | null {
  try {
    return sessionStorage.getItem(HV_LEAD_ID_KEY);
  } catch {
    return null;
  }
}

function readUnlocked(): boolean {
  try {
    return sessionStorage.getItem(HV_UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function formatCurrency(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function confidenceClasses(confidence?: ConfidenceLabel) {
  switch (confidence) {
    case "high":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "medium":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "low":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function parseAddressString(input: string): AddressSelection | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 3) {
    const street = parts[0];
    const city = parts[1];
    const stateZip = parts[2].split(/\s+/).filter(Boolean);
    const state = stateZip[0] || "CA";
    const zip = stateZip[1] || "";

    return {
      fullAddress: trimmed,
      street,
      city,
      state,
      zip,
    };
  }

  return {
    fullAddress: trimmed,
    street: trimmed,
    city: "Unknown",
    state: "CA",
    zip: "",
  };
}

function uiPropertyTypeToApi(t?: EstimateRequestDetails["propertyType"]): string | undefined {
  switch (t) {
    case "single_family":
      return "single family";
    case "condo":
      return "condo";
    case "townhome":
      return "townhome";
    case "multi_family":
      return "multi family";
    default:
      return undefined;
  }
}

function dbPropertyTypeToUi(t: string | null | undefined): EstimateRequestDetails["propertyType"] | undefined {
  if (!t || !String(t).trim()) return undefined;
  const x = String(t).toLowerCase();
  if (/condo|apartment|coop/.test(x)) return "condo";
  if (/town|row/.test(x)) return "townhome";
  if (/multi|duplex|triplex|fourplex/.test(x)) return "multi_family";
  return "single_family";
}

function asCondition(v: string | null | undefined): PropertyCondition {
  if (v === "poor" || v === "fair" || v === "average" || v === "good" || v === "excellent") return v;
  return "average";
}

function buildNestedEstimateBody(
  sessionId: string,
  address: AddressSelection,
  details: EstimateRequestDetails
): Record<string, unknown> {
  return {
    address: {
      fullAddress: address.fullAddress,
      city: address.city,
      state: address.state,
      zip: address.zip,
      lat: address.lat,
      lng: address.lng,
    },
    details: {
      beds: details.beds,
      baths: details.baths,
      sqft: details.sqft,
      yearBuilt: details.yearBuilt,
      lotSqft: details.lotSize,
      propertyType: uiPropertyTypeToApi(details.propertyType),
      condition: details.condition ?? "average",
      renovatedRecently: Boolean(details.renovatedRecently),
    },
    context: { sessionId },
  };
}

function HeroAddressInput({
  value,
  onChange,
  onSubmit,
  isBusy,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isBusy: boolean;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="mx-auto max-w-4xl text-center">
        <div className="inline-flex rounded-full border border-slate-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
          PropertyToolsAI
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">
          Estimate Your Home Value Instantly
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-gray-600 md:text-lg">
          Get a smart estimate, see a value range, and unlock a more detailed valuation report in minutes.
        </p>

        <div className="mx-auto mt-8 flex max-w-3xl flex-col gap-3 md:flex-row">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (!isBusy && value.trim()) onSubmit();
              }
            }}
            placeholder="Enter property address, e.g. 123 Main St, Pasadena, CA 91101"
            className="flex-1 rounded-2xl border border-slate-200 px-5 py-4 text-sm outline-none focus:border-gray-400"
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={!value.trim() || isBusy}
            className="rounded-2xl bg-gray-900 px-6 py-4 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isBusy ? "Estimating..." : "Get Estimate"}
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-400">For informational purposes only. Not an appraisal.</div>
      </div>
    </section>
  );
}

function EstimateCard({ result, state }: { result: EstimateResponse | null; state: EstimateUiState }) {
  if (!result && state === "idle") return null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-medium text-gray-500">Estimated Value</div>
          <div className="mt-2 text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">
            {result ? formatCurrency(result.estimate.value) : "Calculating..."}
          </div>
          <div className="mt-3 text-sm text-gray-500">
            Range:{" "}
            {result
              ? `${formatCurrency(result.estimate.rangeLow)} – ${formatCurrency(result.estimate.rangeHigh)}`
              : "—"}
          </div>
        </div>

        <div className="flex flex-col gap-3 md:items-end">
          <div
            className={[
              "inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize",
              confidenceClasses(result?.estimate.confidence),
            ].join(" ")}
          >
            Confidence: {result?.estimate.confidence ?? "—"}
          </div>

          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
            {result?.supportingData?.compCount ?? 0} local data points •{" "}
            {result?.supportingData?.medianPpsf
              ? `${formatCurrency(result.supportingData.medianPpsf)}/sqft benchmark`
              : "benchmark pending"}
          </div>
        </div>
      </div>

      {result?.estimate?.summary ? (
        <p className="mt-6 text-sm leading-relaxed text-gray-700 md:text-base">{result.estimate.summary}</p>
      ) : null}
    </section>
  );
}

function RefinementForm({
  details,
  onChange,
  onRefresh,
  isBusy,
}: {
  details: EstimateRequestDetails;
  onChange: (patch: Partial<EstimateRequestDetails>) => void;
  onRefresh: () => void;
  isBusy: boolean;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Want a More Accurate Estimate?</h2>
          <p className="mt-2 text-sm text-gray-600 md:text-base">
            Add a few details and refresh the estimate to improve confidence.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isBusy}
          className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isBusy ? "Updating..." : "Update Estimate"}
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm text-gray-600">Bedrooms</label>
          <input
            type="number"
            min={0}
            value={details.beds ?? ""}
            onChange={(e) => onChange({ beds: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-gray-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-600">Bathrooms</label>
          <input
            type="number"
            min={0}
            step="0.5"
            value={details.baths ?? ""}
            onChange={(e) => onChange({ baths: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-gray-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-600">Square Feet</label>
          <input
            type="number"
            min={100}
            value={details.sqft ?? ""}
            onChange={(e) => onChange({ sqft: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-gray-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-600">Year Built</label>
          <input
            type="number"
            min={1800}
            max={2100}
            value={details.yearBuilt ?? ""}
            onChange={(e) => onChange({ yearBuilt: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-gray-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-600">Lot Size</label>
          <input
            type="number"
            min={0}
            value={details.lotSize ?? ""}
            onChange={(e) => onChange({ lotSize: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-gray-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-600">Property Type</label>
          <select
            value={details.propertyType ?? ""}
            onChange={(e) =>
              onChange({
                propertyType: e.target.value
                  ? (e.target.value as EstimateRequestDetails["propertyType"])
                  : undefined,
              })
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-gray-400"
          >
            <option value="">Select type</option>
            <option value="single_family">Single Family</option>
            <option value="condo">Condo</option>
            <option value="townhome">Townhome</option>
            <option value="multi_family">Multi Family</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-600">Condition</label>
          <select
            value={details.condition ?? ""}
            onChange={(e) =>
              onChange({
                condition: e.target.value ? (e.target.value as PropertyCondition) : undefined,
              })
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-gray-400"
          >
            <option value="">Select condition</option>
            <option value="poor">Poor</option>
            <option value="fair">Fair</option>
            <option value="average">Average</option>
            <option value="good">Good</option>
            <option value="excellent">Excellent</option>
          </select>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
          <input
            id="renovatedRecently"
            type="checkbox"
            checked={!!details.renovatedRecently}
            onChange={(e) => onChange({ renovatedRecently: e.target.checked })}
            className="h-4 w-4"
          />
          <label htmlFor="renovatedRecently" className="text-sm text-gray-700">
            Renovated recently
          </label>
        </div>
      </div>
    </section>
  );
}

function ReportGate({
  open,
  form,
  onFormChange,
  onUnlock,
  isBusy,
  error,
}: {
  open: boolean;
  form: { name: string; email: string; phone: string };
  onFormChange: (patch: Partial<{ name: string; email: string; phone: string }>) => void;
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

function FullReport({
  estimate,
  unlockResult,
}: {
  estimate: EstimateResponse | null;
  unlockResult: UnlockReportResponse | null;
}) {
  if (!estimate || !unlockResult) return null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            Full Report Unlocked
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">
            Detailed Valuation Report
          </h2>
        </div>

        <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
          {unlockResult.leadId === "—" ? (
            <span>Lead on file — reference ID from your confirmation email if needed.</span>
          ) : (
            <>
              Lead ID: <span className="font-mono font-medium">{unlockResult.leadId}</span>
            </>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 p-5">
          <div className="text-sm text-gray-500">Estimated Value</div>
          <div className="mt-2 text-3xl font-semibold text-gray-900">
            {formatCurrency(unlockResult.report.estimate.value)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-5">
          <div className="text-sm text-gray-500">Value Range</div>
          <div className="mt-2 text-lg font-semibold text-gray-900">
            {formatCurrency(unlockResult.report.estimate.rangeLow)} –{" "}
            {formatCurrency(unlockResult.report.estimate.rangeHigh)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-5">
          <div className="text-sm text-gray-500">Confidence</div>
          <div className="mt-2 text-lg font-semibold capitalize text-gray-900">
            {unlockResult.report.estimate.confidence}
          </div>
          <div className="mt-1 text-sm text-gray-500">
            Score {Math.round(unlockResult.report.estimate.confidenceScore)}/100
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-5">
          <h3 className="text-base font-semibold text-gray-900">Market Snapshot</h3>
          <div className="mt-4 space-y-3 text-sm text-gray-700">
            <div className="flex items-center justify-between">
              <span>Median Price / Sqft</span>
              <span className="font-medium">
                {unlockResult.report.market?.medianPpsf
                  ? `${formatCurrency(unlockResult.report.market.medianPpsf)}/sqft`
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Local Trend</span>
              <span className="font-medium">
                {typeof unlockResult.report.market?.localTrendPct === "number"
                  ? `${(unlockResult.report.market.localTrendPct * 100).toFixed(1)}%`
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Comparable Data Points</span>
              <span className="font-medium">{unlockResult.report.market?.compCount ?? "—"}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-5">
          <h3 className="text-base font-semibold text-gray-900">What This Means</h3>
          <p className="mt-4 text-sm leading-relaxed text-gray-700">
            Based on local pricing, property details, and available market coverage, this estimate suggests where the
            home likely sits in the current market. Use the range, confidence level, and next-step tools to evaluate
            whether you are selling, buying, or investing.
          </p>
        </div>
      </div>
    </section>
  );
}

function NextSteps({ actions }: { actions: string[] }) {
  if (!actions.length) return null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Suggested Next Steps</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => (
          <div key={action} className="rounded-2xl border border-slate-200 bg-gray-50 p-5">
            <div className="text-sm font-medium text-gray-900">{action}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HomeValueEstimatePage() {
  const [uiState, setUiState] = useState<EstimateUiState>("idle");
  const [error, setError] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [addressInput, setAddressInput] = useState("");
  const [address, setAddress] = useState<AddressSelection | null>(null);
  const [details, setDetails] = useState<EstimateRequestDetails>({
    propertyType: "single_family",
    condition: "good",
  });
  const [serverEstimate, setServerEstimate] = useState<HomeValueEstimateResponse | null>(null);
  const [unlockResult, setUnlockResult] = useState<UnlockReportResponse | null>(null);
  const [leadForm, setLeadForm] = useState({ name: "", email: "", phone: "" });

  const estimateResult = useMemo(
    () => (serverEstimate ? apiToEstimateResponse(serverEstimate) : null),
    [serverEstimate]
  );

  useEffect(() => {
    const id = readOrCreateSessionId();
    setSessionId(id);

    void (async () => {
      try {
        const { res, data } = await fetchJson<{ ok?: boolean; session?: Record<string, unknown> | null }>(
          `/api/home-value/session?session_id=${encodeURIComponent(id)}`,
          { method: "GET", cache: "no-store", credentials: "include" }
        );
        if (!res.ok || data?.ok === false || !data.session) return;

        const row = data.session;
        const full = String(row.full_address ?? "").trim();
        if (!full) return;

        const nextAddress: AddressSelection = {
          fullAddress: full,
          city: String(row.city ?? "Unknown"),
          state: String(row.state ?? ""),
          zip: String(row.zip ?? ""),
          lat: row.lat != null ? Number(row.lat) : undefined,
          lng: row.lng != null ? Number(row.lng) : undefined,
        };
        setAddress(nextAddress);
        setAddressInput(full);
        const hydratedDetails: EstimateRequestDetails = {
          propertyType: dbPropertyTypeToUi(String(row.property_type ?? "")) ?? "single_family",
          beds: row.beds != null ? Number(row.beds) : undefined,
          baths: row.baths != null ? Number(row.baths) : undefined,
          sqft: row.sqft != null ? Number(row.sqft) : undefined,
          yearBuilt: row.year_built != null ? Number(row.year_built) : undefined,
          lotSize: row.lot_size != null ? Number(row.lot_size) : undefined,
          condition: asCondition(String(row.condition ?? "average")),
          renovatedRecently: Boolean(row.renovated_recently),
        };
        setDetails(hydratedDetails);

        if (readUnlocked()) {
          setUiState("report_unlocked");
        } else {
          setUiState("address_selected");
        }

        const headers = await mergeAuthHeaders();
        const body = buildNestedEstimateBody(id, nextAddress, hydratedDetails);

        const est = await fetchJson<Record<string, unknown>>("/api/home-value/estimate", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!est.res.ok || est.data.ok === false) return;
        const hydrated = est.data as unknown as HomeValueEstimateResponse;
        if (!hydrated.estimate || !hydrated.sessionId) return;
        setServerEstimate(hydrated);
        persistSessionIdEverywhere(String(hydrated.sessionId));
        setSessionId(String(hydrated.sessionId));

        if (readUnlocked()) {
          const lid = readStoredLeadId() ?? "—";
          setUnlockResult(buildUnlockReportResponse(lid, hydrated));
          setUiState("report_unlocked");
        } else {
          setUiState("report_locked");
        }
      } catch {
        /* no session */
      }
    })();
  }, []);

  const runEstimate = useCallback(
    async (nextAddress?: AddressSelection, nextDetails?: EstimateRequestDetails) => {
      const sid = sessionId || readOrCreateSessionId();
      if (!sid) {
        setError("Session not ready — please refresh.");
        setUiState("error");
        return;
      }
      const addr = nextAddress ?? address;
      if (!addr) {
        setError("Address missing.");
        setUiState("error");
        return;
      }
      const det = nextDetails ?? details;
      if ((det.sqft ?? 0) < 300) {
        setError("Living area should be at least 300 sq ft.");
        setUiState("error");
        return;
      }

      try {
        setError("");
        setUnlockError(null);
        setUiState(serverEstimate ? "refining" : "estimating");

        const headers = await mergeAuthHeaders();
        const body = buildNestedEstimateBody(sid, addr, det);
        const { res, data } = await fetchJson<Record<string, unknown>>("/api/home-value/estimate", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify(body),
        });

        if (!res.ok || data.ok === false) {
          throw new Error(typeof data.error === "string" ? data.error : "Could not compute estimate.");
        }
        const next = data as unknown as HomeValueEstimateResponse;
        if (!next.estimate || typeof next.sessionId !== "string") {
          throw new Error("Unexpected response from server.");
        }

        setServerEstimate(next);
        persistSessionIdEverywhere(next.sessionId);
        setSessionId(next.sessionId);

        setUiState(readUnlocked() ? "report_unlocked" : "report_locked");
        if (readUnlocked()) {
          setUnlockResult((prev) => {
            const lid = prev?.leadId && prev.leadId !== "—" ? prev.leadId : "—";
            return buildUnlockReportResponse(lid, next);
          });
        }
      } catch (err) {
        setUiState("error");
        setError(err instanceof Error ? err.message : "Failed to generate estimate");
      }
    },
    [address, details, serverEstimate, sessionId]
  );

  async function handleEstimateStart() {
    const parsed = parseAddressString(addressInput);
    if (!parsed) {
      setError("Please enter a valid address.");
      setUiState("error");
      return;
    }

    setAddress(parsed);
    setUiState("address_selected");
    await runEstimate(parsed, details);
  }

  async function handleUnlockReport() {
    if (!serverEstimate) return;
    try {
      setUnlockError(null);
      setError("");
      setUiState("unlocking");

      const phoneTrim = leadForm.phone.trim();
      const missing = serverEstimate.normalizedProperty.missingFields ?? [];
      const eng = computeEngagementScore({
        usedTool: true,
        refinedDetails: missing.length === 0,
        unlockedReport: true,
        phoneProvided: Boolean(phoneTrim),
        repeatSession: false,
        clickedCma: false,
        clickedExpert: false,
        highValueProperty: serverEstimate.estimate.point >= HIGH_VALUE_PROPERTY_THRESHOLD_USD,
      });
      const engBand = leadScoreBand(eng);
      const leadIntent = serverEstimate.intentInference.applied;

      const headers = await mergeAuthHeaders();
      const { res, data } = await fetchJson<{ ok?: boolean; error?: string; leadId?: string }>(
        "/api/home-value/unlock-report",
        {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({
            name: leadForm.name.trim(),
            email: leadForm.email.trim(),
            phone: phoneTrim || undefined,
            source: "home_value_estimator",
            tool: "home_value_estimator",
            intent: crmIntentFromLikelyIntent(leadIntent),
            property_address: address?.fullAddress ?? addressInput.trim(),
            session_id: serverEstimate.sessionId,
            full_address: address?.fullAddress ?? addressInput.trim(),
            city: serverEstimate.normalizedProperty.city ?? undefined,
            state: serverEstimate.normalizedProperty.state ?? undefined,
            zip: serverEstimate.normalizedProperty.zip ?? undefined,
            property_value: serverEstimate.estimate.point,
            confidence_score: serverEstimate.confidence.score,
            engagement_score: eng,
            estimate_low: serverEstimate.estimate.low,
            estimate_high: serverEstimate.estimate.high,
            confidence: serverEstimate.confidence.level,
            likely_intent: leadIntent,
            metadata: {
              engagement: "full_report_unlock",
              likely_intent: leadIntent,
              inferred_intent: serverEstimate.intentInference.likely,
              estimate_low: serverEstimate.estimate.low,
              estimate_high: serverEstimate.estimate.high,
              confidence_level: serverEstimate.confidence.level,
              comps_priced: serverEstimate.comps.pricedCount,
              market_source: serverEstimate.market.source,
              leadsmart_ready: true,
              lead_score_band: engBand,
              engagement_score_band: engBand,
            },
          }),
        }
      );

      if (!res.ok || data.ok === false) {
        const msg = typeof data.error === "string" ? data.error : "Failed to unlock report.";
        setUnlockError(msg);
        setUiState("report_locked");
        return;
      }

      const leadId = data.leadId != null ? String(data.leadId) : "—";
      persistUnlocked(leadId);
      setUnlockResult(buildUnlockReportResponse(leadId, serverEstimate));
      setUiState("report_unlocked");
    } catch (err) {
      setUiState("report_locked");
      setUnlockError(err instanceof Error ? err.message : "Failed to unlock report.");
    }
  }

  const nextActions = useMemo(() => {
    if (unlockResult?.report?.recommendations?.actions?.length) {
      return unlockResult.report.recommendations.actions;
    }
    if (estimateResult?.recommendations?.actions?.length) {
      return estimateResult.recommendations.actions;
    }
    return [
      "Get a detailed CMA report",
      "Compare this home with recent local sales",
      "Estimate mortgage affordability",
    ];
  }, [unlockResult, estimateResult]);

  const busyHero = uiState === "estimating" && !serverEstimate;
  const busyRefine = uiState === "estimating" || uiState === "refining";

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <HeroAddressInput
          value={addressInput}
          onChange={setAddressInput}
          onSubmit={() => void handleEstimateStart()}
          isBusy={busyHero}
        />

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <EstimateCard result={estimateResult} state={uiState} />

        {estimateResult ? (
          <>
            <RefinementForm
              details={details}
              onChange={(patch) => setDetails((prev) => ({ ...prev, ...patch }))}
              onRefresh={() => void runEstimate(undefined, details)}
              isBusy={busyRefine}
            />
            <HomeValueTrustDisclaimer />
          </>
        ) : null}

        <ReportGate
          open={!!estimateResult && uiState !== "report_unlocked"}
          form={leadForm}
          onFormChange={(patch) => setLeadForm((prev) => ({ ...prev, ...patch }))}
          onUnlock={() => void handleUnlockReport()}
          isBusy={uiState === "unlocking"}
          error={unlockError}
        />

        <FullReport estimate={estimateResult} unlockResult={unlockResult} />

        {uiState === "report_unlocked" ? <NextSteps actions={nextActions} /> : null}
      </div>
    </div>
  );
}
