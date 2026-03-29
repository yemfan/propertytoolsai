import type { StoredBehaviorEvent } from "@/lib/behaviorStore";

export type UserIntent = "buyer" | "seller" | "investor" | "browser";

export type PriceRange = {
  min: number;
  max: number;
};

export type Urgency = "low" | "medium" | "high";

export type UserProfile = {
  intent: UserIntent;
  priceRange: PriceRange | null;
  location: string | null;
  urgency: Urgency;
  totalEvents: number;
  /** Counts by behavior event type (last N stored events) */
  signals: Record<string, number>;
};

function countByType(events: StoredBehaviorEvent[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of events) {
    out[e.type] = (out[e.type] ?? 0) + 1;
  }
  return out;
}

function num(meta: Record<string, unknown>, key: string): number | null {
  const v = meta[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function latestString(events: StoredBehaviorEvent[], type: string, key: string): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type !== type) continue;
    const v = events[i].metadata[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function inferPriceRange(events: StoredBehaviorEvent[]): PriceRange | null {
  const prices: number[] = [];
  for (const e of events) {
    const p =
      num(e.metadata, "price") ??
      num(e.metadata, "homePrice") ??
      num(e.metadata, "estimatedValue") ??
      num(e.metadata, "value");
    if (p != null && p > 0) prices.push(p);
  }
  if (!prices.length) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min <= 0 && max <= 0) return null;
  const padMin = Math.round(min * 0.85);
  const padMax = Math.round(max * 1.15);
  return { min: Math.max(0, padMin), max: Math.max(padMin + 1, padMax) };
}

function inferLocation(events: StoredBehaviorEvent[]): string | null {
  return (
    latestString(events, "property_viewed", "address") ??
    latestString(events, "cma_used", "address") ??
    latestString(events, "comparison_started", "sample_address") ??
    latestString(events, "mortgage_used", "context") ??
    null
  );
}

function inferUrgency(events: StoredBehaviorEvent[], signals: Record<string, number>): Urgency {
  const recent = events.filter((e) => Date.now() - e.ts < 7 * 24 * 60 * 60 * 1000);
  if (recent.length >= 8) return "high";
  if (recent.length >= 3) return "medium";
  if ((signals.agent_clicked ?? 0) >= 1 || (signals.comparison_started ?? 0) >= 2) return "high";
  if ((signals.cma_used ?? 0) + (signals.mortgage_used ?? 0) >= 3) return "medium";
  return "low";
}

function inferIntent(signals: Record<string, number>): UserIntent {
  const comp = signals.comparison_started ?? 0;
  const inv =
    (signals.cap_rate_used ?? 0) +
    (signals.rental_analyzer_used ?? 0) +
    comp * 2 +
    (signals.cash_flow_used ?? 0);

  const sell =
    (signals.cma_used ?? 0) +
    (signals.home_value_used ?? 0) +
    (signals.property_viewed ?? 0) * 0.5;

  const buy =
    (signals.mortgage_used ?? 0) +
    (signals.affordability_used ?? 0) +
    (signals.rent_vs_buy_used ?? 0);

  const total = inv + sell + buy + 0.01;
  if (total < 2) return "browser";

  if (inv >= sell && inv >= buy) return "investor";
  if (sell >= buy) return "seller";
  if (buy >= sell) return "buyer";
  return "browser";
}

/**
 * Build a heuristic profile from recent stored behavior events (client buffer).
 */
export function buildUserProfile(events: StoredBehaviorEvent[]): UserProfile {
  const signals = countByType(events);
  const intent = inferIntent(signals);
  const priceRange = inferPriceRange(events);
  const location = inferLocation(events);
  const urgency = inferUrgency(events, signals);

  return {
    intent,
    priceRange,
    location,
    urgency,
    totalEvents: events.length,
    signals,
  };
}
