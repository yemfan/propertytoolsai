import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseAdmin } from "@/lib/supabase/admin";

import CampaignListClient, {
  type CampaignRow,
} from "./CampaignListClient";

export const metadata: Metadata = {
  title: "Lead Ad Campaigns | LeadSmart AI",
  description:
    "Manage your Meta Lead Ad campaigns — pause / resume, refresh metrics, view captured leads.",
  robots: { index: false },
};

/**
 * Lead Ad campaigns dashboard. Server-renders the list (token-free
 * SELECT — sensitive columns explicitly omitted) and hands off to
 * the client component for row actions.
 *
 * Phase 2B.3 = pause / resume / archive + insights refresh. Per-
 * campaign detail page + leads list is a separate later surface.
 */
export default async function AdCampaignsPage() {
  const { agentId } = await getCurrentAgentContext();

  const { data, error } = await supabaseAdmin
    .from("lead_ad_campaigns")
    .select(
      "id, social_account_id, meta_campaign_id, meta_ad_id, meta_form_id, meta_ad_account_id, name, objective, status, last_error, daily_budget_cents, start_time, end_time, metrics, metrics_refreshed_at, leads_received_count, last_lead_at, launched_at, created_at",
    )
    .eq("agent_id", String(agentId))
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <p className="text-sm text-red-700">
          Couldn&apos;t load campaigns: {error.message}
        </p>
      </div>
    );
  }

  type DbRow = {
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
    metrics: Record<string, unknown>;
    metrics_refreshed_at: string | null;
    leads_received_count: number;
    last_lead_at: string | null;
    launched_at: string | null;
    created_at: string;
  };

  const rows = (data as DbRow[] | null) ?? [];

  // Pull page-name + IG handle for each unique connection (display only).
  const socialAccountIds = Array.from(
    new Set(rows.map((r) => r.social_account_id)),
  );
  let pageById = new Map<
    string,
    { fb_page_name: string | null; ig_business_username: string | null }
  >();
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

  const campaigns: CampaignRow[] = rows.map((r) => {
    const page = pageById.get(r.social_account_id) ?? null;
    return {
      id: r.id,
      name: r.name,
      status: r.status,
      lastError: r.last_error,
      pageName: page?.fb_page_name ?? null,
      igBusinessUsername: page?.ig_business_username ?? null,
      metaCampaignId: r.meta_campaign_id,
      metaAdAccountId: r.meta_ad_account_id,
      dailyBudgetCents: r.daily_budget_cents,
      startTime: r.start_time,
      endTime: r.end_time,
      leadsReceivedCount: r.leads_received_count,
      lastLeadAt: r.last_lead_at,
      metrics: r.metrics,
      metricsRefreshedAt: r.metrics_refreshed_at,
      launchedAt: r.launched_at,
      createdAt: r.created_at,
    };
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Lead Ad Campaigns
          </h1>
          <p className="text-sm text-gray-500">
            Your Meta Lead Ad history. Pause, resume, or refresh metrics on
            any active campaign.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/dashboard/leads/generate"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            &larr; Generate Leads
          </Link>
          <Link
            href="/dashboard/leads/generate/ads/new"
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + New campaign
          </Link>
        </div>
      </div>

      <CampaignListClient campaigns={campaigns} />
    </div>
  );
}
