import { supabaseServer } from "@/lib/supabaseServer";

type LeadSignals = {
  visits: number;
  return_visits: number;
  avg_session_time: number;
  cma_runs: number;
  home_value_checks: number;
  mortgage_calc: number;
  visited_sell_page: boolean;
  visited_market_page: boolean;
  visited_listing_page: boolean;
  email_open: boolean;
  email_click: boolean;
  sms_reply: boolean;
  estimated_home_value: number;
  zip_demand_score: number;
  engagement_events: number;
};

type ScoreResult = {
  lead_score: number;
  intent: "low" | "medium" | "high";
  intent_level: "low" | "medium" | "high";
  timeline: "0-3 months" | "3-6 months" | "6+ months";
  confidence: number;
  explanation: string[];
};

const SCORE_CACHE_MS = 5 * 60 * 1000;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function boolFromEvents(events: any[], name: string) {
  return events.some((e) => String(e.event_type ?? "").toLowerCase() === name);
}

function countEvents(events: any[], name: string) {
  return events.filter((e) => String(e.event_type ?? "").toLowerCase() === name).length;
}

function mean(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

async function resolveZipDemandScore(zipCode: string | null, city: string | null, state: string | null) {
  if (city && state) {
    const { data } = await supabaseServer
      .from("city_market_data")
      .select("trend,days_on_market,inventory")
      .eq("city", city)
      .eq("state", state)
      .maybeSingle();
    if (data) {
      const trend = String((data as any).trend ?? "stable");
      const dom = Number((data as any).days_on_market ?? 45);
      const inv = Number((data as any).inventory ?? 2000);
      const trendN = trend === "up" ? 0.85 : trend === "down" ? 0.35 : 0.6;
      const speedN = clamp((90 - dom) / 90, 0.2, 1);
      const invN = clamp((3500 - inv) / 3500, 0.2, 1);
      return clamp(trendN * 0.45 + speedN * 0.35 + invN * 0.2, 0, 1);
    }
  }

  if (!zipCode) return 0.5;
  const digits = zipCode.replace(/\D/g, "");
  if (!digits) return 0.5;
  const n = Number(digits.slice(-2));
  return clamp(n / 99, 0.2, 0.95);
}

export async function getLeadSignals(leadId: string): Promise<LeadSignals> {
  const { data: lead, error: leadErr } = await supabaseServer
    .from("leads")
    .select("id,city,zip_code,estimated_home_value,property_address")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr) throw leadErr;
  if (!lead) throw new Error("Lead not found");

  const { data: events, error: evErr } = await supabaseServer
    .from("lead_events")
    .select("event_type,metadata,created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (evErr) throw evErr;
  const ev = (events ?? []) as any[];

  const visits = countEvents(ev, "visit");
  const returnVisits = countEvents(ev, "return_visit");
  const sessionDurations = ev
    .filter((e) => String(e.event_type).toLowerCase() === "visit")
    .map((e) => Number((e.metadata ?? {}).session_time ?? 0))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const avgSession = mean(sessionDurations);

  const cmaRuns = countEvents(ev, "cma_run");
  const homeValueChecks = countEvents(ev, "home_value_check");
  const mortgageCalc = countEvents(ev, "mortgage_calc");
  const visitedSell = boolFromEvents(ev, "visited_sell_page");
  const visitedMarket = boolFromEvents(ev, "visited_market_page");
  const visitedListing = boolFromEvents(ev, "visited_listing_page");
  const emailOpen = boolFromEvents(ev, "email_open");
  const emailClick = boolFromEvents(ev, "email_click");
  const smsReply = boolFromEvents(ev, "sms_reply");

  const propertyValue = Number((lead as any).estimated_home_value ?? 0);
  const address = String((lead as any).property_address ?? "");
  const city = String((lead as any).city ?? "").trim() || (address.split(",")[1] ?? "").trim() || null;
  const state =
    String((address.split(",")[2] ?? "").trim().split(/\s+/)[0] ?? "").toUpperCase() || null;
  const zipDemand = await resolveZipDemandScore((lead as any).zip_code ?? null, city, state);

  return {
    visits,
    return_visits: returnVisits,
    avg_session_time: avgSession,
    cma_runs: cmaRuns,
    home_value_checks: homeValueChecks,
    mortgage_calc: mortgageCalc,
    visited_sell_page: visitedSell,
    visited_market_page: visitedMarket,
    visited_listing_page: visitedListing,
    email_open: emailOpen,
    email_click: emailClick,
    sms_reply: smsReply,
    estimated_home_value: propertyValue,
    zip_demand_score: zipDemand,
    engagement_events: [emailOpen, emailClick, smsReply].filter(Boolean).length,
  };
}

function explain(signals: LeadSignals) {
  const out: string[] = [];
  if (signals.cma_runs >= 2) out.push("Multiple home value checks");
  if (signals.visited_sell_page) out.push("Visited sell house page");
  if (signals.email_click) out.push("Engaged with email");
  if (signals.estimated_home_value > 1000000) out.push("High-value property");
  if (signals.zip_demand_score > 0.7) out.push("Hot market area");
  return out;
}

function computeFromSignals(signals: LeadSignals): ScoreResult {
  const behavior =
    Math.min(signals.visits * 2, 10) +
    Math.min(signals.return_visits * 3, 10) +
    Math.min((signals.avg_session_time / 60) * 2, 10);

  const tool =
    Math.min(signals.cma_runs * 8, 16) +
    Math.min(signals.home_value_checks * 3, 6) +
    Math.min(signals.mortgage_calc * 1, 3);

  const intentScore =
    (signals.visited_sell_page ? 12 : 0) +
    (signals.visited_market_page ? 4 : 0) +
    (signals.visited_listing_page ? 4 : 0);

  const engagement =
    (signals.email_open ? 5 : 0) +
    (signals.email_click ? 5 : 0) +
    (signals.sms_reply ? 5 : 0);

  let property = 2;
  if (signals.estimated_home_value > 2000000) property = 5;
  else if (signals.estimated_home_value > 1000000) property = 4;
  else if (signals.estimated_home_value > 700000) property = 3;

  const market = signals.zip_demand_score * 5;

  const score = clamp(behavior + tool + intentScore + engagement + property + market, 0, 100);

  const intent: "low" | "medium" | "high" =
    score >= 75 ? "high" : score >= 45 ? "medium" : "low";

  const timeline: "0-3 months" | "3-6 months" | "6+ months" =
    signals.cma_runs >= 2 && signals.visited_sell_page
      ? "0-3 months"
      : signals.visits >= 3
        ? "3-6 months"
        : "6+ months";

  const confidence = clamp(
    (signals.visits + signals.cma_runs + signals.engagement_events) / 20,
    0.2,
    1
  );

  return {
    lead_score: Number(score.toFixed(2)),
    intent,
    intent_level: intent,
    timeline,
    confidence: Number(confidence.toFixed(4)),
    explanation: explain(signals),
  };
}

export async function scoreLead(leadId: string, force = false): Promise<ScoreResult> {
  if (!force) {
    const { data: cached } = await supabaseServer
      .from("lead_scores")
      .select("score,intent,timeline,confidence,explanation,updated_at")
      .eq("lead_id", leadId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      const age = Date.now() - new Date(String((cached as any).updated_at)).getTime();
      if (age <= SCORE_CACHE_MS) {
        return {
          lead_score: Number((cached as any).score ?? 0),
          intent: String((cached as any).intent ?? "low") as any,
          intent_level: String((cached as any).intent ?? "low") as any,
          timeline: String((cached as any).timeline ?? "6+ months") as any,
          confidence: Number((cached as any).confidence ?? 0.2),
          explanation: Array.isArray((cached as any).explanation)
            ? ((cached as any).explanation as string[])
            : [],
        };
      }
    }
  }

  const signals = await getLeadSignals(leadId);
  const result = computeFromSignals(signals);
  const nowIso = new Date().toISOString();
  await supabaseServer.from("lead_scores").insert({
    lead_id: leadId as any,
    score: result.lead_score,
    intent: result.intent,
    timeline: result.timeline,
    confidence: result.confidence,
    explanation: result.explanation,
    updated_at: nowIso,
  } as any);
  return result;
}

export async function rescoreAllLeadsDaily() {
  const { data: leads, error } = await supabaseServer.from("leads").select("id").limit(10000);
  if (error) throw error;
  let processed = 0;
  let failed = 0;
  for (const lead of leads ?? []) {
    processed += 1;
    try {
      await scoreLead(String((lead as any).id), true);
    } catch {
      failed += 1;
    }
  }
  return { processed, failed, succeeded: processed - failed };
}

export async function recordLeadEvent(input: {
  lead_id: string | number;
  event_type: string;
  metadata?: Record<string, any>;
}) {
  await supabaseServer.from("lead_events").insert({
    lead_id: input.lead_id as any,
    event_type: input.event_type,
    metadata: input.metadata ?? {},
  } as any);
}
