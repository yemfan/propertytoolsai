"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mergeAuthHeaders } from "@/lib/mergeAuthHeaders";
import {
  computeEngagementScore,
  crmIntentFromLikelyIntent,
  HIGH_VALUE_PROPERTY_THRESHOLD_USD,
  leadScoreBand,
} from "@/lib/homeValue/engagementScore";
import { fetchJson } from "@/lib/homeValue/fetchJson";
import type { HomeValueEstimateResponse, PropertyCondition, RenovationLevel } from "@/lib/homeValue/types";

const HV_SESSION_KEY = "propertytoolsai:hv_session_id";
const HV_UNLOCK_KEY = "propertytoolsai:hv_report_unlocked";

const REFINE_DEBOUNCE_MS = 480;

export type HomeValueEstimateUiStatus =
  | "idle"
  | "address_selected"
  | "estimating"
  | "preview_ready"
  | "refining"
  | "report_locked"
  | "unlocking"
  | "report_unlocked"
  | "error";

export type HomeValueRefinements = {
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number | null;
  condition: PropertyCondition;
  renovatedRecently: boolean;
};

const defaultRefinements = (): HomeValueRefinements => ({
  beds: 3,
  baths: 2,
  sqft: 1800,
  yearBuilt: null,
  condition: "average",
  renovatedRecently: false,
});

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
    return crypto.randomUUID();
  }
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

function renovationFromBoolean(recent: boolean): RenovationLevel {
  return recent ? "cosmetic" : "none";
}

function buildEstimateBody(
  address: string,
  sessionId: string,
  refinements: HomeValueRefinements,
  prior: HomeValueEstimateResponse | null
): Record<string, unknown> {
  const np = prior?.normalizedProperty;
  return {
    address: address.trim(),
    session_id: sessionId,
    city: np?.city ?? undefined,
    state: np?.state ?? undefined,
    zip: np?.zip ?? undefined,
    lat: np?.lat ?? undefined,
    lng: np?.lng ?? undefined,
    beds: refinements.beds,
    baths: refinements.baths,
    sqft: refinements.sqft,
    yearBuilt: refinements.yearBuilt,
    condition: refinements.condition,
    renovation: renovationFromBoolean(refinements.renovatedRecently),
    intent_signals: { homeValueUsed: true },
  };
}

export type UnlockReportInput = {
  name: string;
  email: string;
  phone: string;
};

export function useHomeValueEstimate() {
  const [sessionId, setSessionId] = useState("");
  const [address, setAddress] = useState("");
  const [addressTouched, setAddressTouched] = useState(false);
  const [refinements, setRefinementsState] = useState<HomeValueRefinements>(defaultRefinements);
  const [result, setResult] = useState<HomeValueEstimateResponse | null>(null);
  const [status, setStatus] = useState<HomeValueEstimateUiStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [reportUnlocked, setReportUnlocked] = useState(false);

  const resultRef = useRef<HomeValueEstimateResponse | null>(null);
  const refinementsRef = useRef(refinements);
  const addressRef = useRef(address);
  const sessionIdRef = useRef(sessionId);
  const reportGateExpandedRef = useRef(false);
  const refineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextRefineDebounce = useRef(false);
  const requestSeq = useRef(0);

  useEffect(() => {
    resultRef.current = result;
  }, [result]);
  useEffect(() => {
    refinementsRef.current = refinements;
  }, [refinements]);
  useEffect(() => {
    addressRef.current = address;
  }, [address]);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    setSessionId(readOrCreateSessionId());
    const u = readUnlocked();
    setReportUnlocked(u);
  }, []);

  useEffect(() => {
    const a = address.trim();
    if (a.length >= 8) {
      if (status === "idle") setStatus("address_selected");
    } else if (status === "address_selected") {
      setStatus("idle");
    }
  }, [address, status]);

  const runEstimate = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    const addr = addressRef.current.trim();
    const sid = sessionIdRef.current;
    const ref = refinementsRef.current;

    if (addr.length < 8) {
      setErrorMessage("Enter a full street address with city, state, or ZIP.");
      setStatus("error");
      return;
    }
    if (!sid) {
      setErrorMessage("Session not ready — please refresh.");
      setStatus("error");
      return;
    }
    if (ref.sqft < 300) {
      setErrorMessage("Living area should be at least 300 sq ft.");
      setStatus("error");
      return;
    }

    const seq = ++requestSeq.current;
    if (!silent) {
      setErrorMessage(null);
      setStatus("estimating");
    } else {
      setStatus((s) => (s === "report_unlocked" ? s : "estimating"));
    }

    try {
      const headers = await mergeAuthHeaders();
      const body = buildEstimateBody(addr, sid, ref, resultRef.current);
      const { res, data: raw } = await fetchJson<Record<string, unknown>>("/api/home-value/estimate", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (seq !== requestSeq.current) return;

      if (!res.ok) {
        throw new Error(typeof raw.error === "string" ? raw.error : "Could not compute estimate.");
      }
      if (raw.ok === false) {
        throw new Error(typeof raw.error === "string" ? raw.error : "Could not compute estimate.");
      }
      if (!raw.estimate || typeof raw.sessionId !== "string") {
        throw new Error("Unexpected response from server.");
      }

      const next = raw as unknown as HomeValueEstimateResponse;
      setResult(next);
      resultRef.current = next;

      try {
        sessionStorage.setItem(HV_SESSION_KEY, String(next.sessionId));
        setSessionId(String(next.sessionId));
        sessionIdRef.current = String(next.sessionId);
      } catch {
        /* ignore */
      }

      skipNextRefineDebounce.current = true;

      if (!silent) {
        setRefinementsState((prev) => {
          const merged = {
            ...prev,
            beds: next.normalizedProperty.beds ?? prev.beds,
            baths: next.normalizedProperty.baths ?? prev.baths,
            sqft: Math.max(300, next.normalizedProperty.sqft ?? prev.sqft),
            yearBuilt: next.normalizedProperty.yearBuilt ?? prev.yearBuilt,
          };
          refinementsRef.current = merged;
          return merged;
        });
      }

      const unlocked = readUnlocked();
      setReportUnlocked(unlocked);
      if (unlocked) {
        setStatus("report_unlocked");
      } else if (reportGateExpandedRef.current) {
        setStatus("report_locked");
      } else {
        setStatus("preview_ready");
      }
    } catch (e) {
      if (seq !== requestSeq.current) return;
      setErrorMessage(e instanceof Error ? e.message : "Something went wrong.");
      setStatus("error");
    }
  }, []);

  const scheduleRefine = useCallback(() => {
    if (!resultRef.current) return;
    if (skipNextRefineDebounce.current) {
      skipNextRefineDebounce.current = false;
      return;
    }
    setStatus((s) => {
      if (s === "unlocking") return s;
      if (s === "report_unlocked") return "refining";
      if (s === "report_locked") return "refining";
      return "refining";
    });
    if (refineTimer.current) clearTimeout(refineTimer.current);
    refineTimer.current = setTimeout(() => {
      refineTimer.current = null;
      void runEstimate({ silent: true });
    }, REFINE_DEBOUNCE_MS);
  }, [runEstimate]);

  useEffect(() => {
    return () => {
      if (refineTimer.current) clearTimeout(refineTimer.current);
    };
  }, []);

  const setRefinements = useCallback(
    (patch: Partial<HomeValueRefinements>) => {
      setRefinementsState((r) => {
        const next = { ...r, ...patch };
        refinementsRef.current = next;
        return next;
      });
      scheduleRefine();
    },
    [scheduleRefine]
  );

  const submitAddress = useCallback(() => {
    setAddressTouched(true);
    void runEstimate();
  }, [runEstimate]);

  const retry = useCallback(() => {
    setErrorMessage(null);
    void runEstimate();
  }, [runEstimate]);

  const openReportGate = useCallback(() => {
    reportGateExpandedRef.current = true;
    if (resultRef.current) setStatus("report_locked");
  }, []);

  const unlockReport = useCallback(async (input: UnlockReportInput) => {
    const res = resultRef.current;
    if (!res) return { ok: false as const, error: "No estimate loaded." };
    setUnlockError(null);
    setStatus("unlocking");

    const phoneTrim = input.phone.trim();
    const missing = res.normalizedProperty.missingFields ?? [];
    const eng = computeEngagementScore({
      usedTool: true,
      refinedDetails: missing.length === 0,
      unlockedReport: true,
      phoneProvided: Boolean(phoneTrim),
      repeatSession: false,
      clickedCma: false,
      clickedExpert: false,
      highValueProperty: res.estimate.point >= HIGH_VALUE_PROPERTY_THRESHOLD_USD,
    });
    const engBand = leadScoreBand(eng);
    const leadIntent = res.intentInference.applied;

    try {
      const headers = await mergeAuthHeaders();
      const { res: httpRes, data: json } = await fetchJson<{
        ok?: boolean;
        error?: string;
        leadId?: string;
      }>("/api/home-value/unlock-report", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          name: input.name.trim(),
          email: input.email.trim(),
          phone: phoneTrim || undefined,
          source: "home_value_estimator",
          tool: "home_value_estimator",
          intent: crmIntentFromLikelyIntent(leadIntent),
          property_address: addressRef.current.trim(),
          session_id: res.sessionId,
          full_address: addressRef.current.trim(),
          city: res.normalizedProperty.city ?? undefined,
          state: res.normalizedProperty.state ?? undefined,
          zip: res.normalizedProperty.zip ?? undefined,
          property_value: res.estimate.point,
          confidence_score: res.confidence.score,
          engagement_score: eng,
          estimate_low: res.estimate.low,
          estimate_high: res.estimate.high,
          confidence: res.confidence.level,
          likely_intent: leadIntent,
          metadata: {
            engagement: "full_report_unlock",
            likely_intent: leadIntent,
            inferred_intent: res.intentInference.likely,
            estimate_low: res.estimate.low,
            estimate_high: res.estimate.high,
            confidence_level: res.confidence.level,
            comps_priced: res.comps.pricedCount,
            market_source: res.market.source,
            leadsmart_ready: true,
            lead_score_band: engBand,
            engagement_score_band: engBand,
          },
        }),
      });

      if (!httpRes.ok || !json.ok) {
        const err = typeof json.error === "string" ? json.error : "Failed to unlock report.";
        setUnlockError(err);
        setStatus("report_locked");
        return { ok: false as const, error: err };
      }

      persistUnlocked();
      setReportUnlocked(true);
      reportGateExpandedRef.current = false;
      setStatus("report_unlocked");
      return { ok: true as const, leadId: json.leadId };
    } catch (e) {
      const err = e instanceof Error ? e.message : "Failed to unlock report.";
      setUnlockError(err);
      setStatus("report_locked");
      return { ok: false as const, error: err };
    }
  }, []);

  const reset = useCallback(() => {
    requestSeq.current += 1;
    if (refineTimer.current) clearTimeout(refineTimer.current);
    refineTimer.current = null;
    reportGateExpandedRef.current = false;
    skipNextRefineDebounce.current = false;
    setAddress("");
    setAddressTouched(false);
    const fresh = defaultRefinements();
    setRefinementsState(fresh);
    refinementsRef.current = fresh;
    setResult(null);
    resultRef.current = null;
    setErrorMessage(null);
    setUnlockError(null);
    setStatus("idle");
    try {
      sessionStorage.removeItem(HV_UNLOCK_KEY);
    } catch {
      /* ignore */
    }
    setReportUnlocked(false);
    const id = crypto.randomUUID();
    try {
      sessionStorage.setItem(HV_SESSION_KEY, id);
    } catch {
      /* ignore */
    }
    setSessionId(id);
    sessionIdRef.current = id;
  }, []);

  const derived = useMemo(
    () => ({
      addressError:
        addressTouched && address.trim().length > 0 && address.trim().length < 8
          ? "Use a full address (street, city, state or ZIP)."
          : null,
      showPreview: Boolean(
        result && ["preview_ready", "refining", "report_locked", "report_unlocked", "estimating"].includes(status)
      ),
    }),
    [address, addressTouched, result, status]
  );

  return {
    sessionId,
    address,
    setAddress,
    addressTouched,
    setAddressTouched,
    refinements,
    setRefinements,
    result,
    status,
    errorMessage,
    unlockError,
    reportUnlocked,
    derived,
    submitAddress,
    retry,
    openReportGate,
    unlockReport,
    reset,
  };
}
