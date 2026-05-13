import { NextResponse } from "next/server";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { fetchCampaignInsights } from "@/lib/leads-gen/meta-ads";
import { decryptToken } from "@/lib/leads-gen/token-enc";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// Meta /insights can take 10-15s on a long-running campaign with lots of data.
export const maxDuration = 60;

/**
 * POST /api/leads-gen/ads/[id]/refresh
 *
 * Pulls fresh insights from Meta + writes them onto
 * lead_ad_campaigns.metrics (jsonb). Leaves the webhook-driven
 * leads_received_count alone — that's the canonical lead count
 * we trust over Meta's lagging actions array.
 *
 * Plan gate: Premium.
 */
export async function POST(
  _req: Request,
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
        { ok: false, error: "Campaign not yet provisioned on Meta." },
        { status: 422 },
      );
    }

    const { data: connRow, error: connErr } = await supabaseAdmin
      .from("social_accounts")
      .select("user_access_token_enc, status")
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
      user_access_token_enc: string | null;
      status: string;
    };
    if (conn.status !== "connected" || !conn.user_access_token_enc) {
      return NextResponse.json(
        { ok: false, error: "Connection unhealthy. Reconnect Facebook." },
        { status: 422 },
      );
    }

    let userToken: string;
    try {
      userToken = decryptToken(conn.user_access_token_enc);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Token decryption failed. Reconnect Facebook." },
        { status: 422 },
      );
    }

    let insights;
    try {
      insights = await fetchCampaignInsights({
        metaCampaignId: camp.meta_campaign_id,
        userAccessToken: userToken,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Insights fetch failed";
      const tagged = e as {
        metaUserMessage?: string | null;
        metaCode?: number | null;
      } | null;
      console.error("[ads/refresh] meta insights failed:", msg);
      return NextResponse.json(
        {
          ok: false,
          error: tagged?.metaUserMessage || msg,
          metaCode: tagged?.metaCode ?? null,
        },
        { status: 502 },
      );
    }

    // Even if insights is null (no data yet — campaign just launched),
    // we stamp metrics_refreshed_at so the UI doesn't keep retrying
    // every page-load. The metrics object stays as whatever it was.
    const nowIso = new Date().toISOString();
    const update: Record<string, unknown> = {
      metrics_refreshed_at: nowIso,
      updated_at: nowIso,
    };
    if (insights) {
      update.metrics = insights;
    }
    await supabaseAdmin
      .from("lead_ad_campaigns")
      .update(update)
      .eq("id", camp.id);

    return NextResponse.json({
      ok: true,
      metrics: insights ?? null,
      refreshedAt: nowIso,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Refresh failed";
    console.error("[leads-gen/ads/refresh]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
