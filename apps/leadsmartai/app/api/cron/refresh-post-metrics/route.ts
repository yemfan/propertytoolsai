import { NextResponse } from "next/server";

import { fetchPostInsights } from "@/lib/leads-gen/meta-post";
import { decryptToken } from "@/lib/leads-gen/token-enc";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// Each post = ~2 Graph calls (≤2-3s each on a healthy day). Budget for
// BATCH_LIMIT * 4s = 200s ceiling; clamp Vercel maxDuration to 300.
export const maxDuration = 300;

/**
 * Vercel cron: auto-refresh engagement metrics on recently-published
 * Meta lead_posts.
 *
 * Schedule: every hour (see vercel.json `crons` config).
 *
 * Why this exists: PR #426 shipped per-post metrics + a manual
 * Refresh button. Without a cron, agents have to tap Refresh on
 * every post to see updated numbers. This closes the loop —
 * metrics show up automatically once Meta has rolled them up.
 *
 * Selection:
 *   - status = 'published' (failed posts have nothing to refresh)
 *   - platform IN ('facebook','instagram') — LinkedIn doesn't
 *     expose post-level analytics on the consumer scope we use
 *   - external_post_id IS NOT NULL (post landed on Meta)
 *   - published_at >= now() - 14 days (engagement plateaus after
 *     that; refreshing 6-month-old posts is wasted Graph budget)
 *   - metrics_refreshed_at IS NULL  OR  metrics_refreshed_at <= now() - 1 hour
 *     (don't burn API budget on freshly-refreshed rows)
 *
 * Bounded fan-out: 50 posts per invocation. With hourly cron, that's
 * a ceiling of 50 published-but-stale posts handled per hour per
 * cron run. If your account has more, the next tick picks them up.
 *
 * Token: page_access_token_enc on social_accounts (admin-level token).
 * Token decryption / Meta API errors stamp metrics_refreshed_at
 * anyway so a broken row doesn't keep cycling to the top of the
 * priority queue every hour. The manual Refresh button surfaces
 * the underlying error to the agent.
 */

const BATCH_LIMIT = 50;
const ENGAGEMENT_WINDOW_DAYS = 14;
const MIN_REFRESH_INTERVAL_MINUTES = 60;

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV !== "production") return true;
    return false;
  }
  const provided = req.headers.get("authorization") ?? "";
  return provided === `Bearer ${secret}`;
}

type StaleRow = {
  id: string;
  agent_id: string;
  social_account_id: string;
  platform: "facebook" | "instagram";
  external_post_id: string;
};

async function selectStalePosts(): Promise<StaleRow[]> {
  const now = Date.now();
  const windowStartIso = new Date(
    now - ENGAGEMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const staleCutoffIso = new Date(
    now - MIN_REFRESH_INTERVAL_MINUTES * 60 * 1000,
  ).toISOString();

  // Never-refreshed rows first (highest signal — they're brand-new posts
  // the agent just published and is most likely watching). Then
  // stale-refresh rows ordered by oldest refresh first.
  const { data: neverRefreshed } = await supabaseAdmin
    .from("lead_posts")
    .select("id, agent_id, social_account_id, platform, external_post_id")
    .eq("status", "published")
    .in("platform", ["facebook", "instagram"])
    .not("external_post_id", "is", null)
    .is("metrics_refreshed_at", null)
    .gte("published_at", windowStartIso)
    .order("published_at", { ascending: false })
    .limit(BATCH_LIMIT);

  const rows: StaleRow[] = ((neverRefreshed as StaleRow[] | null) ?? []);
  const remaining = BATCH_LIMIT - rows.length;
  if (remaining <= 0) return rows;

  const { data: stale } = await supabaseAdmin
    .from("lead_posts")
    .select("id, agent_id, social_account_id, platform, external_post_id")
    .eq("status", "published")
    .in("platform", ["facebook", "instagram"])
    .not("external_post_id", "is", null)
    .lte("metrics_refreshed_at", staleCutoffIso)
    .gte("published_at", windowStartIso)
    .order("metrics_refreshed_at", { ascending: true })
    .limit(remaining);

  rows.push(...((stale as StaleRow[] | null) ?? []));
  return rows;
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const stale = await selectStalePosts();
    if (stale.length === 0) {
      return NextResponse.json({
        ok: true,
        processed: 0,
        summary: "no posts to refresh",
      });
    }

    // Decryption tokens per-row would be wasteful — bulk-load the
    // connections we need into a single map.
    const socialAccountIds = Array.from(
      new Set(stale.map((r) => r.social_account_id)),
    );
    const { data: conns } = await supabaseAdmin
      .from("social_accounts")
      .select("id, agent_id, page_access_token_enc, status")
      .in("id", socialAccountIds);
    type Conn = {
      id: string;
      agent_id: string;
      page_access_token_enc: string | null;
      status: string;
    };
    const connById = new Map<string, Conn>();
    for (const c of (conns as Conn[] | null) ?? []) {
      connById.set(c.id, c);
    }

    let refreshed = 0;
    let skippedNoConn = 0;
    let skippedTokenFail = 0;
    let metaErrors = 0;

    for (const row of stale) {
      const conn = connById.get(row.social_account_id);
      const nowIso = new Date().toISOString();

      if (
        !conn ||
        conn.status !== "connected" ||
        !conn.page_access_token_enc
      ) {
        // Stamp metrics_refreshed_at anyway so this row drops off
        // the stale list — agent has to reconnect before metrics
        // resume.
        await supabaseAdmin
          .from("lead_posts")
          .update({ metrics_refreshed_at: nowIso, updated_at: nowIso })
          .eq("id", row.id);
        skippedNoConn += 1;
        continue;
      }

      let token: string;
      try {
        token = decryptToken(conn.page_access_token_enc);
      } catch {
        await supabaseAdmin
          .from("lead_posts")
          .update({ metrics_refreshed_at: nowIso, updated_at: nowIso })
          .eq("id", row.id);
        skippedTokenFail += 1;
        continue;
      }

      try {
        const insights = await fetchPostInsights({
          platform: row.platform,
          externalPostId: row.external_post_id,
          pageAccessToken: token,
        });
        const update: Record<string, unknown> = {
          metrics_refreshed_at: nowIso,
          updated_at: nowIso,
        };
        if (insights) update.metrics = insights;
        await supabaseAdmin
          .from("lead_posts")
          .update(update)
          .eq("id", row.id);
        refreshed += 1;
      } catch (e) {
        // Meta API failure for this post (e.g. post deleted, rate
        // limit, transient 5xx). Stamp the refresh timestamp so we
        // don't keep retrying this one row every cron run — manual
        // Refresh surfaces the actual error to the agent if they care.
        await supabaseAdmin
          .from("lead_posts")
          .update({ metrics_refreshed_at: nowIso, updated_at: nowIso })
          .eq("id", row.id);
        metaErrors += 1;
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[cron/refresh-post-metrics] meta error", {
          leadPostId: row.id,
          err: msg.slice(0, 200),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: stale.length,
      refreshed,
      skippedNoConn,
      skippedTokenFail,
      metaErrors,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Cron failed";
    console.error("[cron/refresh-post-metrics]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// GET is convenient for manual testing / Vercel dashboard's "Run now".
export const GET = POST;
