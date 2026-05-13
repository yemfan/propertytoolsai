import { NextResponse } from "next/server";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/leads-gen/ads/list
 *
 * Returns the agent's Lead Ad campaigns, newest first. No tokens
 * leak out — the SELECT explicitly omits the social_accounts
 * row's token columns (we only join in the page name + IG handle
 * for display).
 *
 * Plan gate: Premium. Pro agents can see Quick Post but not the
 * Ads dashboard.
 */
export async function GET() {
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

    // Fetch campaigns + the connection's page name (no tokens).
    // Two queries instead of a PostgREST embed since the embed
    // requires the FK relationship to be discovered, which has
    // historically been flaky on this monorepo.
    const { data: rows, error } = await supabaseAdmin
      .from("lead_ad_campaigns")
      .select(
        "id, social_account_id, meta_campaign_id, meta_ad_id, meta_form_id, meta_ad_account_id, name, objective, status, last_error, daily_budget_cents, start_time, end_time, targeting, creative, metrics, metrics_refreshed_at, leads_received_count, last_lead_at, launched_at, created_at",
      )
      .eq("agent_id", auth.agentId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    const campaigns = (rows ?? []) as Array<{
      id: string;
      social_account_id: string;
      meta_campaign_id: string | null;
      meta_ad_id: string | null;
      meta_form_id: string | null;
      meta_ad_account_id: string | null;
      name: string;
      objective: string;
      status: string;
      last_error: string | null;
      daily_budget_cents: number | null;
      start_time: string | null;
      end_time: string | null;
      targeting: Record<string, unknown>;
      creative: Record<string, unknown>;
      metrics: Record<string, unknown>;
      metrics_refreshed_at: string | null;
      leads_received_count: number;
      last_lead_at: string | null;
      launched_at: string | null;
      created_at: string;
    }>;

    // Pull the Page names for the connections referenced. Single
    // bulk query.
    const socialAccountIds = Array.from(
      new Set(campaigns.map((c) => c.social_account_id)),
    );
    let pageById = new Map<string, { fb_page_name: string | null; ig_business_username: string | null }>();
    if (socialAccountIds.length > 0) {
      const { data: connRows } = await supabaseAdmin
        .from("social_accounts")
        .select("id, fb_page_name, ig_business_username")
        .in("id", socialAccountIds);
      pageById = new Map(
        ((connRows as Array<{
          id: string;
          fb_page_name: string | null;
          ig_business_username: string | null;
        }> | null) ?? []).map((r) => [r.id, r]),
      );
    }

    const enriched = campaigns.map((c) => {
      const page = pageById.get(c.social_account_id) ?? null;
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        objective: c.objective,
        lastError: c.last_error,
        pageName: page?.fb_page_name ?? null,
        igBusinessUsername: page?.ig_business_username ?? null,
        metaCampaignId: c.meta_campaign_id,
        metaAdAccountId: c.meta_ad_account_id,
        metaFormId: c.meta_form_id,
        dailyBudgetCents: c.daily_budget_cents,
        startTime: c.start_time,
        endTime: c.end_time,
        leadsReceivedCount: c.leads_received_count,
        lastLeadAt: c.last_lead_at,
        metrics: c.metrics,
        metricsRefreshedAt: c.metrics_refreshed_at,
        launchedAt: c.launched_at,
        createdAt: c.created_at,
      };
    });

    return NextResponse.json({ ok: true, campaigns: enriched });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load campaigns";
    console.error("[leads-gen/ads/list]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
