import { NextResponse } from "next/server";
import { z } from "zod";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { META_GRAPH_BASE } from "@/lib/leads-gen/meta-oauth";
import { decryptToken } from "@/lib/leads-gen/token-enc";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  /** social_accounts.id — the connection that will run the campaign. */
  connectionId: z.string().uuid(),
  /** 'act_<digits>' — Meta ad account id. */
  adAccountId: z.string().min(4),
  /** Same targeting shape as /ads/create. */
  targeting: z.object({
    countries: z.array(z.string().length(2)).optional(),
    zipCodes: z.array(z.string()).max(50).optional(),
    radiusMiles: z.number().int().min(1).max(50).optional(),
    ageMin: z.number().int().min(18).max(65).optional(),
    ageMax: z.number().int().min(18).max(65).optional(),
  }),
});

/**
 * POST /api/leads-gen/ads/audience-estimate
 *
 * Calls Meta's `delivery_estimate` endpoint to preview the audience
 * size for the agent's targeting before they commit budget. Returns
 *   { lower, upper, currency }
 * where lower/upper bracket the population size that matches the
 * targeting. The wizard surfaces this as "Audience: ~50k - 150k" so
 * the agent can sanity-check before launching.
 *
 * Plan gate: Premium (matches the rest of Run Ads).
 *
 * Why we hit Graph directly here rather than via the lib/leads-gen/
 * meta-ads helper: this is a read-only side endpoint, used pre-
 * launch. Folding it into the orchestrator file would mean a
 * separate code path for "look but don't touch" vs the production
 * create path; keeping it inline is clearer.
 */
export async function POST(req: Request) {
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

    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const input = parsed.data;

    // Load the connection so we can pull a user token. Ad-account
    // tokens are reusable across the Marketing API; the user token
    // is what Meta accepts on /delivery_estimate.
    const { data: connRow, error: connErr } = await supabaseAdmin
      .from("social_accounts")
      .select("user_access_token_enc, platform, status")
      .eq("id", input.connectionId)
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
      platform: string;
      status: string;
    };
    if (conn.platform !== "meta" || !conn.user_access_token_enc) {
      return NextResponse.json(
        { ok: false, error: "Connection isn't a Meta connection." },
        { status: 422 },
      );
    }
    if (conn.status !== "connected") {
      return NextResponse.json(
        {
          ok: false,
          error: `Connection status is "${conn.status}". Reconnect first.`,
        },
        { status: 422 },
      );
    }

    let userAccessToken: string;
    try {
      userAccessToken = decryptToken(conn.user_access_token_enc);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Token decrypt failed. Reconnect Facebook." },
        { status: 422 },
      );
    }

    // Translate our targeting shape into Meta's. Same translation
    // the create endpoint does — keeping this inline so the two
    // paths can't drift but acknowledging the duplication.
    const targetingSpec: Record<string, unknown> = {
      geo_locations: {
        countries: input.targeting.countries ?? undefined,
        zips: input.targeting.zipCodes
          ? input.targeting.zipCodes.map((z) => ({
              key: `US:${z}`,
              radius: input.targeting.radiusMiles ?? 10,
              distance_unit: "mile",
            }))
          : undefined,
      },
      age_min: input.targeting.ageMin ?? 18,
      age_max: input.targeting.ageMax ?? 65,
      // HOUSING category — required for real-estate ad targeting per
      // Meta's Special Ad Categories policy. delivery_estimate
      // honors this and returns a population matching the restricted
      // category (no detailed targeting).
      special_ad_categories: ["HOUSING"],
    };

    // delivery_estimate accepts:
    //   - optimization_goal (LEAD_GENERATION matches our create payload)
    //   - targeting_spec (encoded as JSON in a query param)
    //   - access_token
    const url = new URL(`${META_GRAPH_BASE}/${input.adAccountId}/delivery_estimate`);
    url.searchParams.set("optimization_goal", "LEAD_GENERATION");
    url.searchParams.set("targeting_spec", JSON.stringify(targetingSpec));
    url.searchParams.set("access_token", userAccessToken);

    const res = await fetch(url.toString(), { method: "GET" });
    const body = (await res.json().catch(() => ({}))) as {
      data?: Array<{
        estimate_dau?: number;
        estimate_mau_lower_bound?: number;
        estimate_mau_upper_bound?: number;
        estimate_ready?: boolean;
      }>;
      error?: { message?: string; code?: number };
    };

    if (!res.ok || !body.data || body.data.length === 0) {
      const msg = body.error?.message || `HTTP ${res.status}`;
      return NextResponse.json(
        {
          ok: false,
          error: `Audience estimate failed: ${msg}`,
          metaCode: body.error?.code ?? null,
        },
        { status: 502 },
      );
    }
    const first = body.data[0]!;
    return NextResponse.json({
      ok: true,
      estimateReady: first.estimate_ready ?? false,
      mauLower: first.estimate_mau_lower_bound ?? null,
      mauUpper: first.estimate_mau_upper_bound ?? null,
      dau: first.estimate_dau ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Audience estimate failed";
    console.error("[leads-gen/ads/audience-estimate]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
