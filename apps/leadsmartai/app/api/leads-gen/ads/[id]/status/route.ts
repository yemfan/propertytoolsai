import { NextResponse } from "next/server";
import { z } from "zod";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { updateCampaignStatus } from "@/lib/leads-gen/meta-ads";
import { decryptToken } from "@/lib/leads-gen/token-enc";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  /** ACTIVE = resume / launch; PAUSED = pause. ARCHIVED is the soft-delete (campaign stays in
   *  Meta but won't accept further changes). DELETED is the hard option — we don't expose it
   *  in the UI since launching a fresh campaign is cheaper than recovering from accidental
   *  deletes. */
  action: z.enum(["pause", "resume", "archive"]),
});

/**
 * POST /api/leads-gen/ads/[id]/status
 *
 * Pause / resume / archive a Lead Ad campaign. Updates Meta first
 * (so on Meta-side rejection we don't drift the DB), then mirrors
 * the new state onto lead_ad_campaigns.status.
 *
 * Action mapping:
 *   pause   → Meta PAUSED  → DB 'paused'
 *   resume  → Meta ACTIVE  → DB 'active'
 *   archive → Meta ARCHIVED → DB 'completed'
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getDashboardAgentContext();
    if (auth.ok === false) return auth.response;

    const planType = auth.planType.toLowerCase();
    if (planType !== "premium" && planType !== "enterprise") {
      return NextResponse.json(
        { ok: false, error: "Run Ads is a Premium feature." },
        { status: 402 },
      );
    }

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing campaign id" },
        { status: 400 },
      );
    }

    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { action } = parsed.data;

    // Load campaign + connection (ownership-checked).
    const { data: campRow, error: campErr } = await supabaseAdmin
      .from("lead_ad_campaigns")
      .select("id, agent_id, social_account_id, meta_campaign_id, status")
      .eq("id", id)
      .eq("agent_id", auth.agentId)
      .maybeSingle();
    if (campErr) throw campErr;
    if (!campRow) {
      return NextResponse.json(
        { ok: false, error: "Campaign not found." },
        { status: 404 },
      );
    }
    const camp = campRow as {
      id: string;
      social_account_id: string;
      meta_campaign_id: string | null;
      status: string;
    };

    if (!camp.meta_campaign_id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Campaign hasn't reached Meta yet — wait for create to finish before changing status.",
        },
        { status: 422 },
      );
    }

    // Load + decrypt the user token (status updates are an
    // ad-account-level write, not a Page-level write).
    const { data: connRow, error: connErr } = await supabaseAdmin
      .from("social_accounts")
      .select("id, user_access_token_enc, status")
      .eq("id", camp.social_account_id)
      .eq("agent_id", auth.agentId)
      .maybeSingle();
    if (connErr) throw connErr;
    if (!connRow) {
      return NextResponse.json(
        { ok: false, error: "Connection not found." },
        { status: 404 },
      );
    }
    const conn = connRow as {
      id: string;
      user_access_token_enc: string | null;
      status: string;
    };
    if (conn.status !== "connected") {
      return NextResponse.json(
        { ok: false, error: `Connection status is "${conn.status}". Reconnect first.` },
        { status: 422 },
      );
    }
    if (!conn.user_access_token_enc) {
      return NextResponse.json(
        { ok: false, error: "Connection missing user token. Reconnect Facebook." },
        { status: 422 },
      );
    }

    let userToken: string;
    try {
      userToken = decryptToken(conn.user_access_token_enc);
    } catch (e) {
      console.error("[ads/status] token decrypt:", e);
      return NextResponse.json(
        { ok: false, error: "Token decryption failed. Reconnect Facebook." },
        { status: 422 },
      );
    }

    const metaStatus =
      action === "pause"
        ? "PAUSED"
        : action === "resume"
          ? "ACTIVE"
          : "ARCHIVED";

    try {
      await updateCampaignStatus({
        metaCampaignId: camp.meta_campaign_id,
        status: metaStatus,
        userAccessToken: userToken,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Status update failed";
      const tagged = e as { metaUserMessage?: string | null; metaCode?: number | null } | null;
      console.error("[ads/status] meta update failed:", msg);
      return NextResponse.json(
        {
          ok: false,
          error: tagged?.metaUserMessage || msg,
          metaCode: tagged?.metaCode ?? null,
        },
        { status: 502 },
      );
    }

    const dbStatus =
      action === "pause"
        ? "paused"
        : action === "resume"
          ? "active"
          : "completed";

    const nowIso = new Date().toISOString();
    await supabaseAdmin
      .from("lead_ad_campaigns")
      .update({
        status: dbStatus,
        last_error: null,
        updated_at: nowIso,
      } as Record<string, unknown>)
      .eq("id", camp.id);

    return NextResponse.json({ ok: true, status: dbStatus });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Status update failed";
    console.error("[leads-gen/ads/status]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
