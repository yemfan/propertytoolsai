import { NextResponse } from "next/server";
import { z } from "zod";

import { getDashboardAgentContext } from "@/lib/contact-intake/dashboardAgentContext";
import { getMediaById } from "@/lib/leads-gen/media";
import {
  publishFacebookPagePost,
  publishInstagramBusinessPost,
} from "@/lib/leads-gen/meta-post";
import { decryptToken } from "@/lib/leads-gen/token-enc";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// IG container creation + publish + permalink fetch can take a few
// seconds each end-to-end; budget conservatively.
export const maxDuration = 60;

const bodySchema = z.object({
  /** Which platform to publish on — Phase 2A.2 ships facebook + instagram. */
  platform: z.enum(["facebook", "instagram"]),
  /** social_accounts.id — which connection to use for this publish. */
  connectionId: z.string().uuid(),
  /** Post body (already edited by the agent in the wizard). */
  caption: z.string().min(1).max(5_000),
  /** Hashtags array — appended differently per platform (handled here). */
  hashtags: z.array(z.string()).max(40).optional(),
  /** media_library.id of an attached image. Required for Instagram. */
  mediaItemId: z.string().uuid().optional(),
  /** Attribution context — what wizard trigger + subject drove this post. */
  trigger: z.string().max(64).optional(),
  subjectKind: z.string().max(64).optional(),
  subjectRefId: z.string().max(255).optional(),
});

/**
 * POST /api/leads-gen/publish
 *
 * Publishes a Quick Post draft directly to Facebook or Instagram
 * via the connected social_accounts row. Inserts a lead_posts row
 * with the final caption + outcome so the agent sees published
 * history.
 *
 * Failure modes the agent will see:
 *   - 402 — free plan
 *   - 403 — connection not owned by this agent
 *   - 404 — connection or media not found
 *   - 422 — IG requested but the Page has no IG Business linked /
 *           IG requested without an image / etc
 *   - 502 — Meta rejected the publish (real error surfaced from
 *           the Graph API, with code + user-friendly message
 *           when Meta provides them)
 */
export async function POST(req: Request) {
  try {
    const auth = await getDashboardAgentContext();
    if (auth.ok === false) return auth.response;

    if (auth.planType === "free") {
      return NextResponse.json(
        { ok: false, error: "Direct publishing requires Pro or higher." },
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
    const {
      platform,
      connectionId,
      caption: rawCaption,
      hashtags,
      mediaItemId,
      trigger,
      subjectKind,
      subjectRefId,
    } = parsed.data;

    // Final caption — Instagram-style hashtags get appended; FB/IG
    // platform-specific assembly was already done in the AI draft
    // helper for the caption proper, so we only need to apply
    // hashtags here when the wizard hasn't inlined them. Today the
    // wizard inlines for IG and keeps them separate for FB; we
    // honor that by appending only when on IG AND the caption
    // doesn't already include "#".
    let caption = rawCaption.trim();
    if (
      platform === "instagram" &&
      hashtags &&
      hashtags.length > 0 &&
      !caption.includes("#")
    ) {
      const tagLine = hashtags
        .map((h) => `#${h.replace(/^#/, "")}`)
        .join(" ");
      caption = `${caption}\n\n${tagLine}`;
    }

    // 1. Load the connection (ownership-checked) + decrypt tokens.
    const { data: connRow, error: connErr } = await supabaseAdmin
      .from("social_accounts")
      .select(
        "id, agent_id, platform, fb_page_id, ig_business_user_id, page_access_token_enc, status",
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
      fb_page_id: string | null;
      ig_business_user_id: string | null;
      page_access_token_enc: string | null;
      status: string;
    };

    if (conn.status !== "connected") {
      return NextResponse.json(
        {
          ok: false,
          error: `Connection status is "${conn.status}". Reconnect in Settings → Connect platforms.`,
        },
        { status: 422 },
      );
    }
    if (conn.platform !== "meta") {
      return NextResponse.json(
        { ok: false, error: "Connection platform is not Meta." },
        { status: 422 },
      );
    }
    if (!conn.fb_page_id || !conn.page_access_token_enc) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Connection is missing the Facebook Page token. Reconnect to refresh.",
        },
        { status: 422 },
      );
    }
    if (platform === "instagram" && !conn.ig_business_user_id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This Page is not linked to an Instagram Business account. Link one in Facebook, then reconnect.",
        },
        { status: 422 },
      );
    }

    // 2. If an image is attached, load it + materialize a fresh
    //    signed URL (the wizard's signed URL may be hours old by
    //    publish time). For Instagram an image is mandatory.
    let mediaItem:
      | Awaited<ReturnType<typeof getMediaById>>
      | null = null;
    let imageUrl: string | null = null;
    if (mediaItemId) {
      mediaItem = await getMediaById(auth.agentId, mediaItemId);
      if (!mediaItem) {
        return NextResponse.json(
          { ok: false, error: "Image not found in your library." },
          { status: 404 },
        );
      }
      imageUrl = mediaItem.signedUrl;
      if (!imageUrl) {
        return NextResponse.json(
          { ok: false, error: "Could not generate a temporary URL for the image." },
          { status: 500 },
        );
      }
    }
    if (platform === "instagram" && !imageUrl) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Instagram posts require an image. Attach one in the wizard, or post to Facebook only.",
        },
        { status: 422 },
      );
    }

    // 3. Decrypt the Page token (only at the point of use; never
    //    log the plaintext).
    let pageAccessToken: string;
    try {
      pageAccessToken = decryptToken(conn.page_access_token_enc);
    } catch (e) {
      // Token decryption failure usually means SOCIAL_TOKEN_ENC_KEY
      // was rotated without re-encrypting rows. Mark the connection
      // as errored so the agent sees "Reconnect" instead of
      // confusing 500s on every subsequent attempt.
      try {
        await supabaseAdmin
          .from("social_accounts")
          .update({
            status: "error",
            last_error: "Token decryption failed",
            updated_at: new Date().toISOString(),
          } as Record<string, unknown>)
          .eq("id", conn.id);
      } catch {
        // ignore
      }
      const msg = e instanceof Error ? e.message : "Token decryption failed";
      console.error("[leads-gen/publish] token decrypt failed:", msg);
      return NextResponse.json(
        {
          ok: false,
          error: "Connection token is invalid. Reconnect Facebook to publish.",
        },
        { status: 422 },
      );
    }

    // 4. Insert a pending row up-front so even on a Meta-side
    //    timeout (or our crash mid-publish), the agent's history
    //    shows the attempt with status='pending' / 'failed'
    //    instead of a phantom successful post.
    const { data: pendingRow, error: pendingErr } = await supabaseAdmin
      .from("lead_posts")
      .insert({
        agent_id: auth.agentId,
        social_account_id: conn.id,
        platform,
        caption,
        hashtags: hashtags ?? [],
        media_library_id: mediaItem?.id ?? null,
        media_url_used: imageUrl,
        trigger_kind: trigger ?? null,
        subject_kind: subjectKind ?? null,
        subject_ref_id: subjectRefId ?? null,
        status: "pending",
      } as Record<string, unknown>)
      .select("id")
      .single();
    if (pendingErr) throw pendingErr;
    const leadPostId = (pendingRow as { id: string }).id;

    // 5. Call Meta.
    try {
      const result =
        platform === "facebook"
          ? await publishFacebookPagePost({
              pageId: conn.fb_page_id,
              pageAccessToken,
              caption,
              imageUrl,
            })
          : await publishInstagramBusinessPost({
              igUserId: conn.ig_business_user_id!,
              pageAccessToken,
              caption,
              imageUrl: imageUrl!,
            });

      const nowIso = new Date().toISOString();
      await supabaseAdmin
        .from("lead_posts")
        .update({
          status: "published",
          external_post_id: result.externalPostId,
          external_post_url: result.externalPostUrl,
          published_at: nowIso,
          updated_at: nowIso,
        } as Record<string, unknown>)
        .eq("id", leadPostId);

      return NextResponse.json({
        ok: true,
        postId: leadPostId,
        externalPostId: result.externalPostId,
        externalPostUrl: result.externalPostUrl,
        platform,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Publish failed";
      const tagged = e as {
        metaCode?: number | null;
        metaSubcode?: number | null;
        metaUserMessage?: string | null;
        metaTraceId?: string | null;
      } | null;

      await supabaseAdmin
        .from("lead_posts")
        .update({
          status: "failed",
          error_message: msg.slice(0, 1000),
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq("id", leadPostId);

      console.error("[leads-gen/publish] meta publish error:", msg, {
        metaCode: tagged?.metaCode,
        metaTraceId: tagged?.metaTraceId,
      });
      // 502 = Meta-side failure. The agent can retry — usually a
      // transient Graph error, occasionally a policy block.
      return NextResponse.json(
        {
          ok: false,
          error: tagged?.metaUserMessage || msg,
          metaCode: tagged?.metaCode ?? null,
          metaTraceId: tagged?.metaTraceId ?? null,
          postId: leadPostId,
        },
        { status: 502 },
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Publish failed";
    console.error("[leads-gen/publish]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
