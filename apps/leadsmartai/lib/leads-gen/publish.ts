import "server-only";

import { getMediaById } from "./media";
import {
  publishFacebookPagePost,
  publishInstagramBusinessPost,
} from "./meta-post";
import { decryptToken } from "./token-enc";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Shared publish helper. The sync /api/leads-gen/publish route and
 * the /api/cron/publish-scheduled cron both call this — single
 * implementation of the Meta-side orchestration + lead_posts row
 * management. Returning a discriminated-union result keeps callers
 * declarative (they decide HTTP status / retry behavior based on
 * the result shape, this helper just publishes).
 *
 * Flow:
 *   1. Load + ownership-check the social_accounts row
 *   2. Optional image: load from media library + signed URL
 *   3. Decrypt the Page token
 *   4. Insert a lead_posts row in 'pending' status (forensic audit)
 *   5. Call the appropriate Meta helper (FB feed or IG two-step)
 *   6. Promote lead_posts to 'published' or 'failed' based on outcome
 *   7. Return { ok, leadPostId, externalPostId, externalPostUrl }
 *      or { ok: false, status, error, metaCode? } on failure
 *
 * Note on plan-gating: this helper trusts the caller did the plan
 * check. Both the sync route and the cron job verify plan before
 * dispatching here (cron checks each row's agent's plan in case
 * an agent downgraded between scheduling and firing).
 */

export type PublishInput = {
  agentId: string;
  platform: "facebook" | "instagram";
  /** social_accounts.id */
  connectionId: string;
  /** Post body. Caller has already done platform-specific formatting. */
  caption: string;
  /** Hashtag tokens (no leading #). For IG, helper appends inline; for FB stays separate. */
  hashtags?: string[];
  /** media_library.id of an attached image. Required for Instagram. */
  mediaItemId?: string | null;
  /** Attribution context — recorded on the lead_posts row. */
  trigger?: string | null;
  subjectKind?: string | null;
  subjectRefId?: string | null;
};

export type PublishSuccess = {
  ok: true;
  leadPostId: string;
  externalPostId: string;
  externalPostUrl: string | null;
  platform: "facebook" | "instagram";
};

export type PublishFailure = {
  ok: false;
  /** Suggested HTTP status for the caller to respond with. */
  status: 404 | 422 | 500 | 502;
  error: string;
  metaCode?: number | null;
  metaUserMessage?: string | null;
  metaTraceId?: string | null;
  /** When the lead_posts row was created before failure (post-DB-write failures). */
  leadPostId?: string | null;
  /** Hint for the cron: true means the error is transient (Meta side glitch)
   *  and worth retrying; false means it's a permanent error (token revoked,
   *  Page deleted, etc) so the cron should not retry. */
  retryable: boolean;
};

export type PublishResult = PublishSuccess | PublishFailure;

export async function publishPost(input: PublishInput): Promise<PublishResult> {
  const {
    agentId,
    platform,
    connectionId,
    caption: rawCaption,
    hashtags,
    mediaItemId,
    trigger,
    subjectKind,
    subjectRefId,
  } = input;

  // Caption assembly — for IG, append hashtags inline (Meta IG posts
  // expect hashtags in the body, not as a separate field). For FB,
  // hashtags stay separate on the lead_posts row but aren't inlined.
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

  // 1. Connection + ownership.
  const { data: connRow, error: connErr } = await supabaseAdmin
    .from("social_accounts")
    .select(
      "id, agent_id, platform, fb_page_id, ig_business_user_id, page_access_token_enc, status",
    )
    .eq("id", connectionId)
    .eq("agent_id", agentId)
    .maybeSingle();
  if (connErr) {
    return {
      ok: false,
      status: 500,
      error: connErr.message,
      retryable: true,
    };
  }
  if (!connRow) {
    return {
      ok: false,
      status: 404,
      error: "Connection not found.",
      retryable: false,
    };
  }

  const conn = connRow as {
    id: string;
    platform: string;
    fb_page_id: string | null;
    ig_business_user_id: string | null;
    page_access_token_enc: string | null;
    status: string;
  };

  if (conn.platform !== "meta") {
    return {
      ok: false,
      status: 422,
      error: "Connection platform is not Meta.",
      retryable: false,
    };
  }
  if (conn.status !== "connected") {
    return {
      ok: false,
      status: 422,
      error: `Connection status is "${conn.status}". Reconnect in Settings → Connect platforms.`,
      retryable: false,
    };
  }
  if (!conn.fb_page_id || !conn.page_access_token_enc) {
    return {
      ok: false,
      status: 422,
      error:
        "Connection is missing the Facebook Page token. Reconnect to refresh.",
      retryable: false,
    };
  }
  if (platform === "instagram" && !conn.ig_business_user_id) {
    return {
      ok: false,
      status: 422,
      error:
        "This Page is not linked to an Instagram Business account. Link one in Facebook, then reconnect.",
      retryable: false,
    };
  }

  // 2. Image — required for IG, optional for FB.
  let mediaLibraryId: string | null = null;
  let imageUrl: string | null = null;
  if (mediaItemId) {
    const media = await getMediaById(agentId, mediaItemId);
    if (!media) {
      return {
        ok: false,
        status: 404,
        error: "Image not found in your library.",
        retryable: false,
      };
    }
    if (!media.signedUrl) {
      return {
        ok: false,
        status: 500,
        error: "Could not generate a temporary URL for the image.",
        retryable: true,
      };
    }
    mediaLibraryId = media.id;
    imageUrl = media.signedUrl;
  }
  if (platform === "instagram" && !imageUrl) {
    return {
      ok: false,
      status: 422,
      error:
        "Instagram posts require an image. Attach one in the wizard, or post to Facebook only.",
      retryable: false,
    };
  }

  // 3. Decrypt page token at the point of use.
  let pageAccessToken: string;
  try {
    pageAccessToken = decryptToken(conn.page_access_token_enc);
  } catch (e) {
    // Token decryption failure usually means SOCIAL_TOKEN_ENC_KEY was
    // rotated without re-encrypting rows. Mark the connection errored
    // so subsequent attempts surface "Reconnect" instead of confusing
    // 500s on every retry.
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
      // ignore — best-effort housekeeping
    }
    const msg = e instanceof Error ? e.message : "Token decryption failed";
    console.error("[leads-gen/publish] token decrypt failed:", msg);
    return {
      ok: false,
      status: 422,
      error: "Connection token is invalid. Reconnect Facebook to publish.",
      retryable: false,
    };
  }

  // 4. Insert a pending lead_posts row up-front so even on a Meta-
  //    side timeout or a mid-publish crash we have an audit row.
  const { data: pendingRow, error: pendingErr } = await supabaseAdmin
    .from("lead_posts")
    .insert({
      agent_id: agentId,
      social_account_id: conn.id,
      platform,
      caption,
      hashtags: hashtags ?? [],
      media_library_id: mediaLibraryId,
      media_url_used: imageUrl,
      trigger_kind: trigger ?? null,
      subject_kind: subjectKind ?? null,
      subject_ref_id: subjectRefId ?? null,
      status: "pending",
    } as Record<string, unknown>)
    .select("id")
    .single();
  if (pendingErr) {
    return {
      ok: false,
      status: 500,
      error: pendingErr.message,
      retryable: true,
    };
  }
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

    return {
      ok: true,
      leadPostId,
      externalPostId: result.externalPostId,
      externalPostUrl: result.externalPostUrl,
      platform,
    };
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

    // Distinguishing retryable from permanent: code-based heuristic.
    //   - 100/190/200 family (auth) → permanent, agent needs to reconnect
    //   - 4/17/32 (rate limit) → retryable
    //   - 1/2 (general API / unexpected) → retryable
    //   - Everything else → retryable by default (transient)
    const PERMANENT_CODES = new Set([100, 190, 200, 803, 506]);
    const retryable = tagged?.metaCode
      ? !PERMANENT_CODES.has(tagged.metaCode)
      : true;

    return {
      ok: false,
      status: 502,
      error: tagged?.metaUserMessage || msg,
      metaCode: tagged?.metaCode ?? null,
      metaUserMessage: tagged?.metaUserMessage ?? null,
      metaTraceId: tagged?.metaTraceId ?? null,
      leadPostId,
      retryable,
    };
  }
}
