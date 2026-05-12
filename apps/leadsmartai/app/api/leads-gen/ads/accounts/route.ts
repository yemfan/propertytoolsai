import { NextResponse } from "next/server";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { listAdAccountsForUser } from "@/lib/leads-gen/meta-ads";
import { decryptToken } from "@/lib/leads-gen/token-enc";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/leads-gen/ads/accounts?connectionId=<uuid>
 *
 * Returns the Meta ad accounts the agent can use for a given
 * social_accounts connection. Powers the ad-account picker in the
 * Phase 2B.2 wizard.
 *
 * Why this isn't done at OAuth time: ad-account scope (ads_management +
 * business_management) is granted at OAuth, but a single Business
 * Manager can host many ad accounts and they can be added / closed
 * over time. Fetching at wizard-open time keeps the picker fresh
 * without forcing a re-auth every time a new ad account is provisioned.
 *
 * Plan gate: Phase 2B is Premium-only (per the pricing decision).
 * Free + Pro plans return 402 with an upgrade hint.
 */
export async function GET(req: Request) {
  try {
    const auth = await getDashboardAgentContext();
    if (auth.ok === false) return auth.response;

    const planType = auth.planType.toLowerCase();
    // Premium-only feature. Pro keeps Quick Post (Phase 1) but
    // doesn't get Run Ads.
    if (planType !== "premium" && planType !== "enterprise") {
      return NextResponse.json(
        { ok: false, error: "Run Ads is a Premium feature." },
        { status: 402 },
      );
    }

    const url = new URL(req.url);
    const connectionId = (url.searchParams.get("connectionId") ?? "").trim();
    if (!connectionId) {
      return NextResponse.json(
        { ok: false, error: "Missing connectionId param." },
        { status: 400 },
      );
    }

    // Load the connection (ownership-checked) and pull the user
    // token — ad-account discovery uses the user token, NOT the
    // Page token (ad accounts are user/business-scoped).
    const { data: connRow, error: connErr } = await supabaseAdmin
      .from("social_accounts")
      .select(
        "id, platform, user_access_token_enc, status, fb_page_name",
      )
      .eq("id", connectionId)
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
      platform: string;
      user_access_token_enc: string | null;
      status: string;
      fb_page_name: string | null;
    };

    if (conn.platform !== "meta") {
      return NextResponse.json(
        { ok: false, error: "Ad accounts are only available for Meta connections." },
        { status: 422 },
      );
    }
    if (conn.status !== "connected") {
      return NextResponse.json(
        {
          ok: false,
          error: `Connection status is "${conn.status}". Reconnect in Connect platforms.`,
        },
        { status: 422 },
      );
    }
    if (!conn.user_access_token_enc) {
      return NextResponse.json(
        {
          ok: false,
          error: "Connection is missing the user token. Reconnect Facebook.",
        },
        { status: 422 },
      );
    }

    let userToken: string;
    try {
      userToken = decryptToken(conn.user_access_token_enc);
    } catch (e) {
      console.error("[leads-gen/ads/accounts] token decrypt:", e);
      return NextResponse.json(
        { ok: false, error: "Token decryption failed. Reconnect Facebook." },
        { status: 422 },
      );
    }

    const accounts = await listAdAccountsForUser(userToken);
    return NextResponse.json({
      ok: true,
      connection: {
        id: conn.id,
        pageName: conn.fb_page_name,
      },
      accounts,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load ad accounts";
    const tagged = e as {
      metaCode?: number | null;
      metaUserMessage?: string | null;
    } | null;
    console.error("[leads-gen/ads/accounts]", e);
    return NextResponse.json(
      {
        ok: false,
        error: tagged?.metaUserMessage || msg,
        metaCode: tagged?.metaCode ?? null,
      },
      { status: 500 },
    );
  }
}
