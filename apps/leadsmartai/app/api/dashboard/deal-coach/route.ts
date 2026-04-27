import { NextResponse } from "next/server";

import { subscriptionRequiredResponse, userHasCrmFeature } from "@/lib/billing/subscriptionAccess";
import { runDealCoach, type DealCoachServiceInput } from "@/lib/dealCoach/service";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import type { DealStage } from "@/lib/dealCoach/types";

export const runtime = "nodejs";

const VALID_STAGES: DealStage[] = ["drafting", "sent", "countered", "accepted", "rejected"];
const VALID_HEAT = ["hot", "balanced", "cool"] as const;

/**
 * POST — run the AI Deal Coach against agent-supplied deal context. Returns
 * a unified DealCoachReport (strategy + risks + negotiation scripts +
 * prioritized action plan + headline copy).
 *
 * Per-deal hydration (load offer + listing + comps from Supabase by deal id)
 * is intentionally a follow-up. For v1, the coach takes its inputs from the
 * agent — they're often working a deal where the data lives in the listing
 * agent's system, not ours.
 */

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }
  return undefined;
}

function asString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

function asStage(v: unknown): DealStage | undefined {
  if (typeof v !== "string") return undefined;
  return VALID_STAGES.includes(v as DealStage) ? (v as DealStage) : undefined;
}

function asHeat(v: unknown): "hot" | "balanced" | "cool" | undefined {
  if (typeof v !== "string") return undefined;
  return (VALID_HEAT as readonly string[]).includes(v) ? (v as "hot" | "balanced" | "cool") : undefined;
}

export async function POST(req: Request) {
  try {
    const supabase = supabaseServerClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!userData.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    if (!(await userHasCrmFeature(userData.user.id, "prediction"))) {
      return subscriptionRequiredResponse("prediction", "crm_prediction_locked");
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const stage = asStage(body.stage);
    if (!stage) {
      return NextResponse.json({ ok: false, error: "stage_required" }, { status: 400 });
    }

    const input: DealCoachServiceInput = {
      stage,
      hoursSinceLastAgentAction: asNumber(body.hoursSinceLastAgentAction),
      hoursSinceLastChange: asNumber(body.hoursSinceLastChange),
      budgetTight: body.budgetTight === true,
      listPrice: asNumber(body.listPrice),
      budgetMax: asNumber(body.budgetMax),
      comparablesMedian: asNumber(body.comparablesMedian),
      daysOnMarket: asNumber(body.daysOnMarket),
      marketHeat: asHeat(body.marketHeat),
      competingOfferCount: asNumber(body.competingOfferCount),
      propertyAddress: asString(body.propertyAddress),
      buyerNotes: asString(body.buyerNotes),
    };

    const report = await runDealCoach(input);
    return NextResponse.json({ ok: true, report });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("deal-coach", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
