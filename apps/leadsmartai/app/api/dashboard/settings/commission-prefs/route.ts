import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET/PATCH /api/dashboard/settings/commission-prefs
 *
 * Per-agent defaults for commission math. Returns defaults (2.5 buyer /
 * 3.0 listing / 70% split / 0% referral) when no row exists; upserts
 * on PATCH so first-time changes don't 404.
 */
export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { data } = await supabaseAdmin
      .from("agent_commission_prefs")
      .select(
        "default_commission_pct_buyer, default_commission_pct_listing, default_brokerage_split_pct, default_referral_fee_pct",
      )
      .eq("agent_id", agentId)
      .maybeSingle();

    const row = data as {
      default_commission_pct_buyer: number | null;
      default_commission_pct_listing: number | null;
      default_brokerage_split_pct: number | null;
      default_referral_fee_pct: number | null;
    } | null;

    return NextResponse.json({
      ok: true,
      preferences: {
        commissionBuyerPct: row?.default_commission_pct_buyer ?? 2.5,
        commissionListingPct: row?.default_commission_pct_listing ?? 3.0,
        brokerageSplitPct: row?.default_brokerage_split_pct ?? 70.0,
        referralFeePct: row?.default_referral_fee_pct ?? 0.0,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export async function PATCH(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json().catch(() => ({}))) as Partial<{
      commissionBuyerPct: number;
      commissionListingPct: number;
      brokerageSplitPct: number;
      referralFeePct: number;
    }>;

    const patch: Record<string, unknown> = {};
    if (typeof body.commissionBuyerPct === "number") {
      patch.default_commission_pct_buyer = clamp(body.commissionBuyerPct, 0, 15);
    }
    if (typeof body.commissionListingPct === "number") {
      patch.default_commission_pct_listing = clamp(body.commissionListingPct, 0, 15);
    }
    if (typeof body.brokerageSplitPct === "number") {
      patch.default_brokerage_split_pct = clamp(body.brokerageSplitPct, 0, 100);
    }
    if (typeof body.referralFeePct === "number") {
      patch.default_referral_fee_pct = clamp(body.referralFeePct, 0, 100);
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "No fields to update." }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("agent_commission_prefs")
      .upsert(
        { agent_id: agentId, ...patch, updated_at: new Date().toISOString() },
        { onConflict: "agent_id" },
      );
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
