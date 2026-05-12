import "server-only";

import { META_GRAPH_BASE } from "./meta-oauth";

/**
 * Meta Graph API posting helpers — Facebook Page feed + Instagram
 * Business content publish. Token + page-id resolution happens in
 * the caller (`/api/leads-gen/publish`); these helpers are pure
 * "given a token + an image URL + a caption, ship the post" wrappers.
 *
 * Both helpers throw on Meta-side rejection, with the most useful
 * Meta error fields stuffed into the message + onto the Error
 * object so the publish endpoint can surface them to the agent.
 */

export type PublishResult = {
  externalPostId: string;
  /** Public URL Meta returns for the published post (when available). */
  externalPostUrl: string | null;
};

type GraphError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_msg?: string;
  fbtrace_id?: string;
};

function tagError(err: Error, ge: GraphError | undefined): Error {
  if (ge) {
    Object.assign(err, {
      metaCode: ge.code ?? null,
      metaSubcode: ge.error_subcode ?? null,
      metaUserMessage: ge.error_user_msg ?? null,
      metaTraceId: ge.fbtrace_id ?? null,
    });
  }
  return err;
}

// ── Facebook Page post ───────────────────────────────────────────────

/**
 * Publish to a Facebook Page.
 *
 * Two endpoints depending on whether we're attaching an image:
 *   - With image: POST /{page-id}/photos (image goes in the feed
 *     with caption as the post body — Meta's canonical "photo post")
 *   - Without image: POST /{page-id}/feed
 *
 * Returns the post id Meta minted ({page-id}_{post-id} format
 * for /feed; {photo-id} for /photos). The post URL is built from
 * the id when present.
 *
 * Token must be a Page Access Token (NOT a user token) — Page
 * tokens are what /me/accounts returns during OAuth.
 */
export async function publishFacebookPagePost(params: {
  pageId: string;
  pageAccessToken: string;
  caption: string;
  imageUrl: string | null;
}): Promise<PublishResult> {
  const { pageId, pageAccessToken, caption, imageUrl } = params;

  let endpoint: string;
  const form = new URLSearchParams();
  form.set("access_token", pageAccessToken);

  if (imageUrl) {
    endpoint = `${META_GRAPH_BASE}/${pageId}/photos`;
    form.set("url", imageUrl);
    form.set("caption", caption);
    // Always publish (vs upload-then-publish-later). Phase 2 doesn't
    // schedule; that's a separate UX surface.
    form.set("published", "true");
  } else {
    endpoint = `${META_GRAPH_BASE}/${pageId}/feed`;
    form.set("message", caption);
  }

  const res = await fetch(endpoint, {
    method: "POST",
    body: form,
  });
  type Resp = { id?: string; post_id?: string; error?: GraphError };
  const body = (await res.json().catch(() => ({}))) as Resp;

  if (!res.ok || (!body.id && !body.post_id)) {
    const msg = body.error?.message || `HTTP ${res.status}`;
    throw tagError(
      new Error(`Facebook publish failed: ${msg}`),
      body.error,
    );
  }

  // /feed returns { id: "<page-id>_<post-id>" } — that's the
  // post id directly. /photos returns { id: <photo-id>,
  // post_id: "<page-id>_<post-id>" }; we prefer post_id when
  // both are present so the URL points at the timeline post
  // (with the photo) rather than the standalone photo viewer.
  const externalPostId = body.post_id || body.id!;
  return {
    externalPostId,
    externalPostUrl: facebookPostUrl(externalPostId),
  };
}

/**
 * Build a viewable Facebook post URL from the Graph `post_id`.
 * Format: {page-id}_{post-id} → https://www.facebook.com/{page-id}/posts/{post-id}
 *
 * Returns null if the id doesn't have the expected underscore
 * format — defensive against future API quirks.
 */
function facebookPostUrl(externalPostId: string): string | null {
  const underscore = externalPostId.indexOf("_");
  if (underscore <= 0) return null;
  const pageId = externalPostId.slice(0, underscore);
  const postId = externalPostId.slice(underscore + 1);
  return `https://www.facebook.com/${pageId}/posts/${postId}`;
}

// ── Instagram Business post ──────────────────────────────────────────

/**
 * Publish to an Instagram Business account.
 *
 * Two-step process per Meta's IG Content Publishing docs:
 *   1. POST /{ig-user-id}/media — create a "media container" with
 *      the image_url + caption. Meta downloads the image at this
 *      point.
 *   2. POST /{ig-user-id}/media_publish — promote the container
 *      to a real post. Returns the media id.
 *
 * Important: Meta requires `image_url` to be PUBLICLY accessible
 * for the duration of the container creation. Our signed library
 * URLs are public-with-token for ~1h, which is more than enough.
 *
 * Token: the Page Access Token for the Page the IG Business is
 * linked to (NOT a user token, NOT a separate IG token).
 *
 * Image is required for IG. We surface this as a friendlier
 * "Instagram needs an image" check in the publish endpoint before
 * getting here — by the time control reaches this helper we
 * assume `imageUrl` is set.
 */
export async function publishInstagramBusinessPost(params: {
  igUserId: string;
  pageAccessToken: string;
  caption: string;
  imageUrl: string;
}): Promise<PublishResult> {
  const { igUserId, pageAccessToken, caption, imageUrl } = params;

  // Step 1: create the media container.
  const containerForm = new URLSearchParams();
  containerForm.set("image_url", imageUrl);
  containerForm.set("caption", caption);
  containerForm.set("access_token", pageAccessToken);

  const containerRes = await fetch(
    `${META_GRAPH_BASE}/${igUserId}/media`,
    { method: "POST", body: containerForm },
  );
  type ContainerResp = { id?: string; error?: GraphError };
  const containerBody = (await containerRes.json().catch(() => ({}))) as ContainerResp;
  if (!containerRes.ok || !containerBody.id) {
    const msg = containerBody.error?.message || `HTTP ${containerRes.status}`;
    throw tagError(
      new Error(`Instagram media container creation failed: ${msg}`),
      containerBody.error,
    );
  }
  const containerId = containerBody.id;

  // Step 2: publish the container.
  const publishForm = new URLSearchParams();
  publishForm.set("creation_id", containerId);
  publishForm.set("access_token", pageAccessToken);

  const publishRes = await fetch(
    `${META_GRAPH_BASE}/${igUserId}/media_publish`,
    { method: "POST", body: publishForm },
  );
  type PublishResp = { id?: string; error?: GraphError };
  const publishBody = (await publishRes.json().catch(() => ({}))) as PublishResp;
  if (!publishRes.ok || !publishBody.id) {
    const msg = publishBody.error?.message || `HTTP ${publishRes.status}`;
    throw tagError(
      new Error(`Instagram publish failed: ${msg}`),
      publishBody.error,
    );
  }

  // Resolve the public IG URL via /{media-id}?fields=permalink so
  // the agent can click through to view the post. Best-effort —
  // failure here doesn't fail the publish since the post is already
  // live by this point.
  let externalPostUrl: string | null = null;
  try {
    const permalinkRes = await fetch(
      `${META_GRAPH_BASE}/${publishBody.id}?fields=permalink&access_token=${encodeURIComponent(
        pageAccessToken,
      )}`,
    );
    const permalinkBody = (await permalinkRes.json().catch(() => ({}))) as {
      permalink?: string;
    };
    if (permalinkRes.ok && permalinkBody.permalink) {
      externalPostUrl = permalinkBody.permalink;
    }
  } catch {
    // ignore
  }

  return {
    externalPostId: publishBody.id,
    externalPostUrl,
  };
}
