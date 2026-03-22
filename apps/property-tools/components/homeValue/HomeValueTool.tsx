"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ToolPageScaffold from "@/components/layout/ToolPageScaffold";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import LeadCaptureModal from "@/components/LeadCaptureModal";
import { useAddressPrefill } from "@/hooks/useAddressPrefill";
import { trackEvent, trackHomeValueUsed, trackPropertyViewed } from "@/lib/tracking";
import {
  computeHomeValueEngagementScore,
  crmIntentFromLikelyIntent,
} from "@/lib/homeValue/engagementScore";
import type {
  HomeValueEstimateResponse,
  PropertyCondition,
  RenovationLevel,
  UserIntent,
} from "@/lib/homeValue/types";

const HV_UNLOCK_KEY = "propertytoolsai:hv_report_unlocked";
const HV_SESSION_KEY = "propertytoolsai:hv_session_id";

function readOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(HV_SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(HV_SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

function asCurrency(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "--";
  return `$${Math.round(value).toLocaleString()}`;
}

function readUnlocked() {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(HV_UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function persistUnlocked() {
  try {
    sessionStorage.setItem(HV_UNLOCK_KEY, "1");
  } catch {
    /* ignore */
  }
}


export function HomeValueToolInner() {
  const searchParams = useSearchParams();
  const queryAddress = searchParams?.get("address");
  const { address, setAddress, saveSelectedAddress } = useAddressPrefill(queryAddress, {
    skipLocalStorage: true,
  });

  const [placeMeta, setPlaceMeta] = useState<{
    city: string | null;
    state: string | null;
    zip: string | null;
    lat: number | null;
    lng: number | null;
  }>({ city: null, state: null, zip: null, lat: null, lng: null });

  const [beds, setBeds] = useState("3");
  const [baths, setBaths] = useState("2");
  const [sqft, setSqft] = useState("1800");
  const [lotSqft, setLotSqft] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [propertyType, setPropertyType] = useState("single family");
  const [condition, setCondition] = useState<PropertyCondition>("average");
  const [renovation, setRenovation] = useState<RenovationLevel>("none");
  const [userIntent, setUserIntent] = useState<UserIntent>("seller");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HomeValueEstimateResponse | null>(null);

  const [reportUnlocked, setReportUnlocked] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "ready">("idle");

  useEffect(() => {
    setReportUnlocked(readUnlocked());
    void trackEvent("tool_used", { tool: "home_value", phase: "page_load" });
  }, []);

  const buildPayload = useCallback(() => {
    const b = Number(beds) || undefined;
    const ba = Number(baths) || undefined;
    const s = Number(sqft) || undefined;
    const lot = lotSqft.trim() ? Number(lotSqft) : undefined;
    const yb = yearBuilt.trim() ? Number(yearBuilt) : undefined;
    return {
      address: address.trim(),
      city: placeMeta.city,
      state: placeMeta.state,
      zip: placeMeta.zip,
      lat: placeMeta.lat,
      lng: placeMeta.lng,
      beds: b,
      baths: ba,
      sqft: s,
      lotSqft: lot && isFinite(lot) ? lot : undefined,
      yearBuilt: yb && isFinite(yb) ? yb : undefined,
      propertyType: propertyType || undefined,
      condition,
      renovation,
      intent: userIntent,
      session_id: readOrCreateSessionId() || undefined,
    };
  }, [
    address,
    placeMeta,
    beds,
    baths,
    sqft,
    lotSqft,
    yearBuilt,
    propertyType,
    condition,
    renovation,
    userIntent,
  ]);

  /** After each API response, skip one debounced refine (avoids duplicate fetch). */
  const suppressRefineFromApi = useRef(false);

  const runEstimate = useCallback(
    async (opts?: { silent?: boolean }) => {
      const p = buildPayload();
      if (!p.address.trim()) {
        setError("Enter a property address.");
        return;
      }
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/home-value-estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        });
        const json = (await res.json()) as HomeValueEstimateResponse | { ok: false; error?: string };
        if (!res.ok || !("ok" in json) || json.ok !== true) {
          throw new Error((json as { error?: string }).error ?? "Estimate failed");
        }
        if ("sessionId" in json && typeof (json as { sessionId?: string }).sessionId === "string") {
          try {
            sessionStorage.setItem(HV_SESSION_KEY, (json as { sessionId: string }).sessionId);
          } catch {
            /* ignore */
          }
        }
        suppressRefineFromApi.current = true;
        setResult(json);
        setPhase("ready");
        if (json.normalizedProperty) {
          const np = json.normalizedProperty;
          if (np.beds != null) setBeds(String(np.beds));
          if (np.baths != null) setBaths(String(np.baths));
          if (np.sqft != null) setSqft(String(np.sqft));
          if (np.lotSqft != null) setLotSqft(String(np.lotSqft));
          if (np.yearBuilt != null) setYearBuilt(String(np.yearBuilt));
          if (np.propertyType) setPropertyType(np.propertyType);
        }
        if (!opts?.silent) {
          void trackEvent("tool_used", { tool: "home_value", phase: "estimate_complete" });
          const addr = p.address.trim();
          if (addr) void trackPropertyViewed({ address: addr, source: "home_value" });
          void trackHomeValueUsed({
            address: addr,
            beds: Number(p.beds) || undefined,
            sqft: Number(p.sqft) || undefined,
          });
          requestAnimationFrame(() => {
            document.getElementById("home-value-results")?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to estimate");
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [buildPayload]
  );

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (phase !== "ready") return;
    if (suppressRefineFromApi.current) {
      suppressRefineFromApi.current = false;
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      void runEstimate({ silent: true });
    }, 450);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [
    phase,
    beds,
    baths,
    sqft,
    lotSqft,
    yearBuilt,
    propertyType,
    condition,
    renovation,
    userIntent,
    runEstimate,
  ]);

  const estimate = result?.estimate ?? null;
  const confidence = result?.confidence ?? null;
  const showFullReport = reportUnlocked || !estimate;

  const openUnlock = () => setLeadModalOpen(true);

  const missingHint = useMemo(() => {
    const m = result?.normalizedProperty?.missingFields ?? [];
    if (!m.length) return null;
    return `Some details are missing — refine ${m.join(", ")} below for a tighter range.`;
  }, [result]);

  const engagementScore = useMemo(() => {
    const missing = result?.normalizedProperty?.missingFields ?? [];
    const fieldsCompleteRatio = 1 - Math.min(1, missing.length / 6);
    return computeHomeValueEngagementScore({
      confidenceScore: result?.confidence?.score ?? 0,
      fieldsCompleteRatio,
      pricedCompCount: result?.comps?.pricedCount ?? 0,
      hasEstimate: Boolean(result?.estimate),
      requestedFullReport: true,
      hasPhone: false,
      likelyIntent: userIntent,
    });
  }, [result, userIntent]);

  return (
    <>
      <ToolPageScaffold
        title="Home Value Estimate"
        subtitle="Pick an address for an instant estimate, refine details for a tighter range, then unlock the full report. Estimates use local market data and comparable sales when available."
        inputTitle="Property"
        inputDescription="Address & details"
        resultTitle="Estimate"
        resultDescription="Value, range & confidence"
        inputContent={
          <Card className="p-5">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
                <AddressAutocomplete
                  value={address}
                  onChange={setAddress}
                  onBlur={() => {
                    const t = address.trim();
                    if (!t) return;
                    saveSelectedAddress({
                      formattedAddress: t,
                      lat: null,
                      lng: null,
                      placeId: null,
                      city: null,
                      state: null,
                      zip: null,
                    });
                  }}
                  onSelect={(val) => {
                    saveSelectedAddress({
                      formattedAddress: val.formattedAddress,
                      lat: val.lat,
                      lng: val.lng,
                      placeId: val.placeId ?? null,
                      city: val.city ?? null,
                      state: val.state ?? null,
                      zip: val.zip ?? null,
                    });
                    setPlaceMeta({
                      city: val.city ?? null,
                      state: val.state ?? null,
                      zip: val.zip ?? null,
                      lat: val.lat ?? null,
                      lng: val.lng ?? null,
                    });
                    void runEstimate();
                  }}
                  wrapperClassName="w-full"
                  placeholder="Search for an address, city, or ZIP"
                />
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  I&apos;m mostly a…
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["seller", "Seller / owner"],
                      ["buyer", "Buyer"],
                      ["investor", "Investor"],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setUserIntent(v)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        userIntent === v
                          ? "border-[#0072ce] bg-[#0072ce]/10 text-[#005ca8]"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="mb-2 text-sm font-semibold text-slate-800">Refine (live recalc)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Beds</label>
                    <input
                      value={beds}
                      onChange={(e) => setBeds(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Baths</label>
                    <input
                      value={baths}
                      onChange={(e) => setBaths(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Sqft</label>
                    <input
                      value={sqft}
                      onChange={(e) => setSqft(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Lot (sqft)</label>
                    <input
                      value={lotSqft}
                      onChange={(e) => setLotSqft(e.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Year built</label>
                    <input
                      value={yearBuilt}
                      onChange={(e) => setYearBuilt(e.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Property type</label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="single family">Single family</option>
                    <option value="condo">Condo / apartment</option>
                    <option value="townhouse">Townhouse</option>
                    <option value="multi-family">Multi-family</option>
                  </select>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Condition</label>
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value as PropertyCondition)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="poor">Poor</option>
                      <option value="fair">Fair</option>
                      <option value="average">Average</option>
                      <option value="good">Good</option>
                      <option value="excellent">Excellent</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Renovations</label>
                    <select
                      value={renovation}
                      onChange={(e) => setRenovation(e.target.value as RenovationLevel)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="none">None recent</option>
                      <option value="cosmetic">Cosmetic</option>
                      <option value="major">Major</option>
                      <option value="full">Full / gut</option>
                    </select>
                  </div>
                </div>
              </div>

              {error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
              ) : null}

              <Button
                type="button"
                className="w-full"
                disabled={loading}
                onClick={() => void runEstimate()}
              >
                {loading ? "Estimating…" : phase === "ready" ? "Recalculate now" : "Run estimate"}
              </Button>
            </div>
          </Card>
        }
        resultContent={
          <Card id="home-value-results" className="scroll-mt-4 p-5">
            {!estimate ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                Select an address from suggestions or tap <strong>Run estimate</strong> after typing a full
                address. We&apos;ll pull comps when available and local median $/sqft.
              </div>
            ) : !showFullReport ? (
              <div className="space-y-4">
                {missingHint ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{missingHint}</p>
                ) : null}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Estimated value
                  </div>
                  <div className="mt-1 text-3xl font-bold text-blue-700">
                    {asCurrency(estimate.point)}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Range {asCurrency(estimate.low)} – {asCurrency(estimate.high)}
                  </p>
                  {confidence ? (
                    <p className="mt-2 text-sm text-slate-700">
                      Confidence:{" "}
                      <span className="font-semibold capitalize">{confidence.level}</span> (
                      {confidence.score}/100) · {result?.comps.pricedCount ?? 0} comparable sales used
                    </p>
                  ) : null}
                </div>

                <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="pointer-events-none select-none blur-sm opacity-60" aria-hidden>
                    <p className="text-sm text-slate-700">{estimate.summary}</p>
                    <ul className="mt-2 list-inside list-disc text-xs text-slate-600">
                      {estimate.adjustments.slice(0, 6).map((a) => (
                        <li key={a.key}>
                          {a.label}: ×{a.multiplier.toFixed(3)}
                        </li>
                      ))}
                    </ul>
                    {result?.market ? (
                      <p className="mt-2 text-xs text-slate-600">
                        Market: {result.market.city}, {result.market.state} ({result.market.trend})
                      </p>
                    ) : null}
                  </div>
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 to-white/60" />
                </div>

                <Button className="w-full" variant="cta" type="button" onClick={openUnlock}>
                  Unlock full report
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Estimated value
                  </div>
                  <div className="mt-1 text-3xl font-bold text-blue-700">
                    {asCurrency(estimate.point)}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Range {asCurrency(estimate.low)} – {asCurrency(estimate.high)}
                  </p>
                </div>
                {confidence ? (
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-800">
                    <p>
                      <span className="font-semibold">Confidence</span> {confidence.level} ({confidence.score}
                      /100)
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-600">
                      {confidence.factors.slice(0, 5).map((f) => (
                        <li key={f.key}>
                          {f.label} ({f.impact > 0 ? "+" : ""}
                          {f.impact})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div>
                  <p className="text-sm font-semibold text-slate-800">Adjustments</p>
                  <ul className="mt-2 list-inside list-disc text-sm text-slate-700">
                    {estimate.adjustments.map((a) => (
                      <li key={a.key}>
                        {a.label}: ×{a.multiplier.toFixed(3)}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-sm text-slate-700">{estimate.summary}</p>
                {result?.recommendations?.length ? (
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Recommended next steps</p>
                    <ul className="mt-2 space-y-2">
                      {result.recommendations.map((r) => (
                        <li key={r.href}>
                          <Link
                            href={r.href}
                            className="font-semibold text-[#0072ce] underline-offset-2 hover:underline"
                          >
                            {r.title}
                          </Link>
                          <span className="text-slate-600"> — {r.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </Card>
        }
      />

      <LeadCaptureModal
        open={leadModalOpen}
        onOpenChange={setLeadModalOpen}
        source="home_value_estimator"
        tool="home_value_estimator"
        intent={crmIntentFromLikelyIntent(userIntent)}
        propertyAddress={address.trim()}
        sessionId={readOrCreateSessionId()}
        geo={{
          city: placeMeta.city,
          state: placeMeta.state,
          zip: placeMeta.zip,
        }}
        title="Unlock full report"
        subtitle="Get adjustment detail, confidence factors, and next steps. Leads use source home_value_estimator and route to LeadSmart AI."
        leadExtras={{
          property_value: estimate?.point,
          confidence_score: confidence?.score,
          engagement_score: engagementScore,
          metadata: {
            engagement: "full_report_unlock",
            likely_intent: userIntent,
            inferred_intent: userIntent,
            estimate_low: estimate?.low,
            estimate_high: estimate?.high,
            confidence_level: confidence?.level,
            comps_priced: result?.comps.pricedCount,
            market_source: result?.market?.source,
            leadsmart_ready: true,
          },
        }}
        onSuccess={() => {
          persistUnlocked();
          setReportUnlocked(true);
        }}
      />
    </>
  );
}

export default function HomeValueTool() {
  return (
    <Suspense fallback={<div className="min-h-[240px]" aria-hidden />}>
      <HomeValueToolInner />
    </Suspense>
  );
}
