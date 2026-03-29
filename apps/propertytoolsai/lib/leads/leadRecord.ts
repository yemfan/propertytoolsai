/**
 * Canonical lead shape for home value estimator CRM + API responses.
 */
import type { LikelyIntent } from "@/lib/homeValue/types";

export type LeadRecordStatus = "new" | "qualified" | "assigned" | "contacted";

export type LeadRecord = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  source: "home_value_estimator";
  fullAddress?: string;
  city?: string;
  state?: string;
  zip?: string;
  estimatedValue?: number;
  estimateLow?: number;
  estimateHigh?: number;
  confidence?: "low" | "medium" | "high";
  confidenceScore?: number;
  likelyIntent?: LikelyIntent;
  engagementScore?: number;
  status?: LeadRecordStatus;
  createdAt: string;
  /** Optional funnel fields from capture form */
  timeline?: string;
  buyingOrSelling?: string;
};

function normalizeConfidence(v: string | null | undefined): "low" | "medium" | "high" | undefined {
  if (!v) return undefined;
  const s = String(v).toLowerCase();
  if (s === "low" || s === "medium" || s === "high") return s;
  return undefined;
}

export function buildLeadRecordFromUnlockBody(input: {
  leadId: string;
  name?: string;
  email?: string;
  phone?: string;
  fullAddress?: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  propertyValue?: number;
  estimateLow?: number;
  estimateHigh?: number;
  confidence?: string | null;
  confidenceScore?: number | null;
  likelyIntent?: string | null;
  engagementScore?: number | null;
  status?: LeadRecordStatus;
  createdAt?: string;
  timeline?: string | null;
  buyingOrSelling?: string | null;
}): LeadRecord {
  return {
    id: input.leadId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    source: "home_value_estimator",
    fullAddress: input.fullAddress,
    city: input.city ?? undefined,
    state: input.state ?? undefined,
    zip: input.zip ?? undefined,
    estimatedValue: input.propertyValue,
    estimateLow: input.estimateLow,
    estimateHigh: input.estimateHigh,
    confidence: normalizeConfidence(input.confidence ?? undefined),
    confidenceScore:
      input.confidenceScore != null && Number.isFinite(input.confidenceScore)
        ? Math.round(Number(input.confidenceScore))
        : undefined,
    likelyIntent:
      input.likelyIntent === "seller" ||
      input.likelyIntent === "buyer" ||
      input.likelyIntent === "investor" ||
      input.likelyIntent === "unknown"
        ? input.likelyIntent
        : undefined,
    engagementScore:
      input.engagementScore != null && Number.isFinite(input.engagementScore)
        ? Math.round(Number(input.engagementScore))
        : undefined,
    status: input.status ?? "new",
    createdAt: input.createdAt ?? new Date().toISOString(),
    timeline: input.timeline ?? undefined,
    buyingOrSelling: input.buyingOrSelling ?? undefined,
  };
}
