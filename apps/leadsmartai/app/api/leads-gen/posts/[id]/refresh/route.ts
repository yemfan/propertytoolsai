import { NextResponse } from "next/server";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { fetchPostInsights } from "@/lib/leads-gen/meta-post";
import { decryptToken } from "@/lib/leads-gen/token-enc";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// Two-call insights fetch can take 5-10s on a busy post with lots
// of comments/reactions for Meta to roll up.
export const maxDuration = 30;

/**
 * POST /api/leads-gen/posts/[id]/refresh
 *
 * Pulls fresh engagement (likes / comments / impressions / reach
 * / etc.) from Meta's Graph API and writes it onto
 * `lead_posts.metrics` (jsonb). Mirrors the pattern in
 * /api/leads-gen/ads/[id]/refresh but at the post grain.
 *
 * Plan gate: Pro+ (matches the rest of Generate Leads).
 *
 * LinkedIn posts return 422 — the `w_member_social` consumer scope
 * we use doesn't expose post analytics. The UI shows
 * "metrics unavailable" for those rows.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getDashboardAgentContext();
    if (auth.ok === false) return auth.response;

    if (auth.planType === "free") {
      return NextResponse.json(
        { ok: false, error: "Generate Leads requires Pro or higher." },
        { status: 402 },
      );
    }

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing post id" },
        { status: 400 },
      );
    }

    const { data: postRow, error: postErr } = await supabaseAdmin
      .from("lead_posts")
      .select(
        "id, agent_id, social_account_id, platform, external_post_id, status",
      )
      .eq("id", id)
      .eq("agent_id", auth.agentId)
      .maybeSingle();
    if (postErr) throw postErr;
    if (!postRow) {
      return NextResponse.json(
        { ok: false, error: "Post not found." },
        { status: 404 },
      );
    }
    const post = postRow as {
      id: string;
      social_account_id: string;
      platform: "facebook" | "instagram" | "linkedin";
      external_post_id: string | null;
      status: string;
    };

    if (post.status !== "published" || !post.external_post_id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            post.status === "failed"
              ? "Post never published — nothing to refresh."
              : "Post hasn't published yet.",
        },
        { status: 422 },
      );
    }

    if (post.platform === "linkedin") {
      // Don't even bill the round-trip — short-circuit with a clear
      // reason so the UI can stamp metrics_refreshed_at and stop
      // retrying on every page load.
      const nowIso = new Date().toISOString();
      await supabaseAdmin
        .from("lead_posts")
        .update({
          metrics_refreshed_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", post.id);
      return NextResponse.json(
        {
          ok: false,
          error:
            "LinkedIn organic post metrics aren't available via the API. View on LinkedIn.",
          refreshedAt: nowIso,
        },
        { status: 422 },
      );
    }

    const { data: connRow, error: connErr } = await supabaseAdmin
      .from("social_accounts")
      .select("page_access_token_enc, status")
      .eq("id", post.social_account_id)
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
      page_access_token_enc: string | null;
      status: string;
    };
    if (conn.status !== "connected" || !conn.page_access_token_enc) {
      return NextResponse.json(
        { ok: false, error: "Connection unhealthy. Reconnect Facebook." },
        { status: 422 },
      );
    }

    let pageToken: string;
    try {
      pageToken = decryptToken(conn.page_access_token_enc);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Token decryption failed. Reconnect Facebook." },
        { status: 422 },
      );
    }

    let insights;
    try {
      insights = await fetchPostInsights({
        platform: post.platform,
        externalPostId: post.external_post_id,
        pageAccessToken: pageToken,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Insights fetch failed";
      const tagged = e as {
        metaUserMessage?: string | null;
        metaCode?: number | null;
      } | null;
      console.error("[posts/refresh] meta insights failed:", msg);
      return NextResponse.json(
        {
          ok: false,
          error: tagged?.metaUserMessage || msg,
          metaCode: tagged?.metaCode ?? null,
        },
        { status: 502 },
      );
    }

    // Stamp metrics_refreshed_at unconditionally so the UI doesn't
    // retry on every render; only overwrite metrics if we actually
    // got fresh data (insights is null for LinkedIn, but we already
    // bailed earlier).
    const nowIso = new Date().toISOString();
    const update: Record<string, unknown> = {
      metrics_refreshed_at: nowIso,
      updated_at: nowIso,
    };
    if (insights) {
      update.metrics = insights;
    }
    await supabaseAdmin.from("lead_posts").update(update).eq("id", post.id);

    return NextResponse.json({
      ok: true,
      metrics: insights ?? null,
      refreshedAt: nowIso,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Refresh failed";
    console.error("[leads-gen/posts/refresh]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
