import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  ContactSignalType,
  LifecycleStage,
  SignalConfidence,
} from "@/lib/contacts/types";

import { computeBuyerPrediction } from "@/lib/buyerPrediction/computeScore";
import type {
  BuyerPredictionLabel,
  BuyerPredictionScoreResult,
} from "@/lib/buyerPrediction/types";

/**
 * Top-N likely-buyers per agent — same cohort + query shape as
 * `lib/spherePrediction/service`, different scoring engine.
 *
 * Cohort: past_client + sphere lifecycle stages. Same source data; the
 * difference is which signals + weights move the score upward (job_change
 * and life_event drive it; listing_activity does NOT — that's seller-only).
 *
 * Query is bounded at LIMIT_CANDIDATES (2,000). Scoring runs in memory.
 * Missing-relation errors degrade to empty result, matching the pattern
 * elsewhere.
 */

const LIFECYCLE_STAGES: LifecycleStage[] = ["past_client", "sphere"];
const LIMIT_CANDIDATES = 2_000;

export type LikelyBuyerRow = {
  contactId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  lifecycleStage: LifecycleStage;
  closingAddress: string | null;
  closingDate: string | null;
  score: number;
  label: BuyerPredictionLabel;
  /** Top reason — first factor with the highest pointsEarned. */
  topReason: string;
  factors: BuyerPredictionScoreResult["factors"];
};

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  lifecycle_stage: LifecycleStage;
  closing_address: string | null;
  closing_date: string | null;
  closing_price: number | null;
  avm_current: number | null;
  avm_updated_at: string | null;
  engagement_score: number | null;
  last_activity_at: string | null;
  last_contacted_at: string | null;
  relationship_type: string | null;
  automation_disabled: boolean | null;
};

type SignalRow = {
  contact_id: string;
  type: ContactSignalType;
  confidence: SignalConfidence;
  detected_at: string;
};

function isMissingRelationError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return (
    e.code === "42P01" ||
    e.code === "42703" ||
    /does not exist|schema cache/i.test(e.message ?? "")
  );
}

function fullNameOf(row: ContactRow): string {
  const parts = [row.first_name, row.last_name].filter(Boolean) as string[];
  if (parts.length > 0) return parts.join(" ").trim();
  return row.email ?? "Unnamed contact";
}

function topReasonOf(result: BuyerPredictionScoreResult): string {
  let best = result.factors[0];
  for (const f of result.factors) {
    if (f.pointsEarned > best.pointsEarned) best = f;
  }
  return best.detail;
}

export async function topLikelyBuyersForAgent(
  agentId: string,
  opts: { limit?: number; minScore?: number; label?: BuyerPredictionLabel } = {},
): Promise<LikelyBuyerRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  const minScore = Math.max(opts.minScore ?? 0, 0);

  const { data: contactRows, error: contactsErr } = await supabaseAdmin
    .from("contacts")
    .select(
      "id,first_name,last_name,email,phone,lifecycle_stage,closing_address,closing_date,closing_price,avm_current,avm_updated_at,engagement_score,last_activity_at,last_contacted_at,relationship_type,automation_disabled",
    )
    .eq("agent_id", agentId as never)
    .in("lifecycle_stage", LIFECYCLE_STAGES as never)
    .limit(LIMIT_CANDIDATES);

  if (contactsErr) {
    if (isMissingRelationError(contactsErr)) return [];
    throw contactsErr;
  }
  if (!contactRows || contactRows.length === 0) return [];

  const candidates = (contactRows as unknown as ContactRow[]).filter(
    (r) => r.automation_disabled !== true,
  );
  if (candidates.length === 0) return [];

  const candidateIds = candidates.map((c) => c.id);
  const { data: signalRows, error: signalsErr } = await supabaseAdmin
    .from("contact_signals")
    .select("contact_id,type,confidence,detected_at")
    .in("contact_id", candidateIds as never)
    .is("dismissed_at", null);

  if (signalsErr && !isMissingRelationError(signalsErr)) throw signalsErr;

  const signalsByContact = new Map<string, SignalRow[]>();
  for (const s of (signalRows ?? []) as unknown as SignalRow[]) {
    const list = signalsByContact.get(s.contact_id) ?? [];
    list.push(s);
    signalsByContact.set(s.contact_id, list);
  }

  const ranked: LikelyBuyerRow[] = [];
  for (const c of candidates) {
    const result = computeBuyerPrediction({
      homePurchaseDate: c.closing_date,
      closingPrice: c.closing_price,
      avmCurrent: c.avm_current,
      avmUpdatedAt: c.avm_updated_at,
      engagementScore: c.engagement_score ?? 0,
      lastActivityAt: c.last_activity_at,
      lastContactedAt: c.last_contacted_at,
      openSignals: (signalsByContact.get(c.id) ?? []).map((s) => ({
        type: s.type,
        confidence: s.confidence,
        detectedAt: s.detected_at,
      })),
      relationshipType: c.relationship_type,
    });

    if (result.score < minScore) continue;
    if (opts.label && result.label !== opts.label) continue;

    ranked.push({
      contactId: c.id,
      fullName: fullNameOf(c),
      email: c.email,
      phone: c.phone,
      lifecycleStage: c.lifecycle_stage,
      closingAddress: c.closing_address,
      closingDate: c.closing_date,
      score: result.score,
      label: result.label,
      topReason: topReasonOf(result),
      factors: result.factors,
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}
