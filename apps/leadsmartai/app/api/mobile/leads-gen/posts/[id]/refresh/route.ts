import { NextResponse } from "next/server";

import { fetchPostInsights } from "@/lib/leads-gen/meta-post";
import { decryptToken } from "@/lib/leads-gen/token-enc";
import { requireMobileAgent } from "@/lib/mobile/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// Two-call insights fetch can take 5-10s on a busy post.
export const maxDuration = 30;

/**
 * POST /api/mobile/leads-gen/posts/[id]/refresh
 *
 * Mobile counterpart to /api/leads-gen/posts/[id]/refresh. Pulls
 * fresh engagement counts from Meta + writes them onto
 * lead_posts.metrics. LinkedIn 422s because the consumer scope
 * doesn't expose post-level analytics.
 *
 * Plan gate: Pro+ (handled by requireMobileAgent + a downstream
 * check on agents.plan_type).
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileAgent(req);
  if (auth.ok === false) return auth.response;

  try {
    // Plan gate — same Pro+ check used by every other Generate Leads endpoint.
    const { data: agentRow } = await supabaseAdmin
      .from("agents")
      .select("plan_type")
      .eq("id", auth.ctx.agentId)
      .maybeSingle();
    const planType = (
      (agentRow as { plan_type: string | null } | null)?.plan_type ?? "free"
    ).toLowerCase();
    if (planType === "free") {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: "Generate Leads requires Pro or higher.",
        },
        { status: 402 },
      );
    }

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json(
        { ok: false, success: false, error: "Missing post id" },
        { status: 400 },
      );
    }

    const { data: postRow, error: postErr } = await supabaseAdmin
      .from("lead_posts")
      .select(
        "id, social_account_id, platform, external_post_id, status",
      )
      .eq("id", id)
      .eq("agent_id", auth.ctx.agentId)
      .maybeSingle();
    if (postErr) throw postErr;
    if (!postRow) {
      return NextResponse.json(
        { ok: false, success: false, error: "Post not found." },
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
          success: false,
          error:
            post.status === "failed"
              ? "Post never published — nothing to refresh."
              : "Post hasn't published yet.",
        },
        { status: 422 },
      );
    }

    if (post.platform === "linkedin") {
      const nowIso = new Date().toISOString();
      await supabaseAdmin
        .from("lead_posts")
        .update({ metrics_refreshed_at: nowIso, updated_at: nowIso })
        .eq("id", post.id);
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error:
            "LinkedIn organic post metrics aren't available via the API.",
          refreshedAt: nowIso,
        },
        { status: 422 },
      );
    }

    const { data: connRow } = await supabaseAdmin
      .from("social_accounts")
      .select("page_access_token_enc, status")
      .eq("id", post.social_account_id)
      .eq("agent_id", auth.ctx.agentId)
      .maybeSingle();
    if (!connRow) {
      return NextResponse.json(
        { ok: false, success: false, error: "Connection not found." },
        { status: 404 },
      );
    }
    const conn = connRow as {
      page_access_token_enc: string | null;
      status: string;
    };
    if (conn.status !== "connected" || !conn.page_access_token_enc) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: "Connection unhealthy. Reconnect Facebook.",
        },
        { status: 422 },
      );
    }

    let pageToken: string;
    try {
      pageToken = decryptToken(conn.page_access_token_enc);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: "Token decryption failed. Reconnect Facebook.",
        },
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
      console.error("[mobile/posts/refresh] meta insights failed:", msg);
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: tagged?.metaUserMessage || msg,
          metaCode: tagged?.metaCode ?? null,
        },
        { status: 502 },
      );
    }

    const nowIso = new Date().toISOString();
    const update: Record<string, unknown> = {
      metrics_refreshed_at: nowIso,
      updated_at: nowIso,
    };
    if (insights) update.metrics = insights;
    await supabaseAdmin.from("lead_posts").update(update).eq("id", post.id);

    return NextResponse.json({
      ok: true,
      success: true,
      metrics: insights ?? null,
      refreshedAt: nowIso,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Refresh failed";
    console.error("[mobile/leads-gen/posts/refresh]", e);
    return NextResponse.json(
      { ok: false, success: false, error: msg },
      { status: 500 },
    );
  }
}
