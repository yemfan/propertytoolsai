"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ToolPageScaffold from "@/components/layout/ToolPageScaffold";
import AddressAutocomplete from "../../components/AddressAutocomplete";
import LeadCaptureModal from "@/components/LeadCaptureModal";
import { useAddressPrefill } from "../../hooks/useAddressPrefill";
import { trackEvent, trackHomeValueUsed, trackPropertyViewed } from "@/lib/tracking";

const HV_UNLOCK_KEY = "propertytoolsai:hv_report_unlocked";

function asCurrency(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "--";
  return `$${Math.round(value).toLocaleString()}`;
}

function readUnlocked(): boolean {
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

function HomeValueToolPageInner() {
  const searchParams = useSearchParams();
  const queryAddress = searchParams?.get("address");
  const { address, setAddress, saveSelectedAddress } = useAddressPrefill(queryAddress);
  const [beds, setBeds] = useState("3");
  const [baths, setBaths] = useState("2");
  const [sqft, setSqft] = useState("1800");
  const [resultReady, setResultReady] = useState(false);
  const [reportUnlocked, setReportUnlocked] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);

  useEffect(() => {
    setReportUnlocked(readUnlocked());
    void trackEvent("tool_used", { tool: "home_value", phase: "page_load" });
  }, []);

  const estimate = useMemo(() => {
    const b = Number(beds) || 0;
    const ba = Number(baths) || 0;
    const s = Number(sqft) || 0;
    if (!resultReady) return null;
    const value = s * 245 + b * 18000 + ba * 11000;
    return {
      estimate: value,
      low: value * 0.94,
      high: value * 1.06,
      confidence: "Medium",
    };
  }, [beds, baths, sqft, resultReady]);

  function handleRunEstimate() {
    setResultReady(true);
    void trackEvent("tool_used", {
      tool: "home_value",
      phase: "calculation",
      address: address.trim() || undefined,
      beds: Number(beds) || undefined,
      baths: Number(baths) || undefined,
      sqft: Number(sqft) || undefined,
    });
    const addr = address.trim();
    if (addr) {
      void trackPropertyViewed({ address: addr, source: "home_value" });
    }
    void trackHomeValueUsed({
      address: addr || undefined,
      beds: Number(beds) || undefined,
      sqft: Number(sqft) || undefined,
    });
  }

  function openUnlockModal() {
    setLeadModalOpen(true);
  }

  const showFullReport = reportUnlocked || !estimate;

  return (
    <>
      <ToolPageScaffold
        title="Home Value Estimate"
        subtitle="Enter property details on the left and review data-driven output on the right."
        inputTitle="Inputs"
        inputDescription="Property details"
        resultTitle="Results"
        resultDescription="Live output preview"
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
                  }}
                  placeholder="123 Main St, City, State"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Beds</label>
                  <input
                    value={beds}
                    onChange={(e) => setBeds(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Baths</label>
                  <input
                    value={baths}
                    onChange={(e) => setBaths(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Sqft</label>
                  <input
                    value={sqft}
                    onChange={(e) => setSqft(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <Button className="w-full" onClick={handleRunEstimate}>
                Run Estimate
              </Button>
            </div>
          </Card>
        }
        resultContent={
          <Card className="p-5">
            {!estimate ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                Results will appear here after you run the estimate.
              </div>
            ) : !showFullReport ? (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Estimated Value
                  </div>
                  <div className="mt-1 text-3xl font-bold text-blue-700">
                    {asCurrency(estimate.estimate)}
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    Unlock full report for detailed breakdown, value range, and confidence context.
                  </p>
                </div>

                <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="pointer-events-none select-none blur-sm opacity-60" aria-hidden>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-slate-500">Range Low</div>
                        <div className="font-semibold">{asCurrency(estimate.low)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Range High</div>
                        <div className="font-semibold">{asCurrency(estimate.high)}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-teal-800">
                      Confidence: {estimate.confidence}
                    </div>
                  </div>
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 to-white/60" />
                </div>

                <Button className="w-full" variant="cta" type="button" onClick={openUnlockModal}>
                  Unlock Full Report
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Estimated Value
                  </div>
                  <div className="mt-1 text-3xl font-bold text-blue-700">
                    {asCurrency(estimate.estimate)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Range Low</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {asCurrency(estimate.low)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Range High</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {asCurrency(estimate.high)}
                    </div>
                  </div>
                </div>
                <div className="rounded-xl bg-teal-50 p-3 text-sm text-teal-800">
                  Confidence: <span className="font-semibold">{estimate.confidence}</span>
                  {address.trim() ? ` for ${address.trim()}` : ""}.
                </div>
              </div>
            )}
          </Card>
        }
      />

      <LeadCaptureModal
        open={leadModalOpen}
        onOpenChange={setLeadModalOpen}
        source="home_value"
        tool="home_value"
        intent="sell"
        propertyAddress={address.trim()}
        onSuccess={() => {
          persistUnlocked();
          setReportUnlocked(true);
        }}
      />
    </>
  );
}

export default function HomeValueToolPage() {
  return (
    <Suspense fallback={<div className="min-h-[240px]" aria-hidden />}>
      <HomeValueToolPageInner />
    </Suspense>
  );
}
