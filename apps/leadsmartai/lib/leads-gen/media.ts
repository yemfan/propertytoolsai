import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Media-library helpers for the Generate Leads feature. The
 * `media_library` table is metadata only — the file bytes live in
 * the private `lead-media` storage bucket. All reads go through
 * `signedUrlFor()` so we don't materialize long-lived public URLs.
 *
 * Per-agent isolation is enforced at the application layer (every
 * helper takes `agentId` and filters on it). Storage RLS policies
 * are intentionally absent — the API routes are the gatekeepers,
 * same pattern as contact_import_jobs.
 */

export const LEAD_MEDIA_BUCKET = "lead-media";

/** How long signed read URLs are valid for. 1 hour — long enough to
 *  cover the agent reading the wizard + clicking share, short enough
 *  that a leaked URL has bounded blast radius. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type MediaKind =
  | "general"
  | "listing_photo"
  | "agent_headshot"
  | "agent_logo"
  | "market_chart"
  | "testimonial_quote";

export type MediaSource = "upload" | "listing_photo" | "derived";

export type MediaItem = {
  id: string;
  agentId: string;
  storagePath: string;
  kind: MediaKind;
  source: MediaSource;
  relatedListingId: string | null;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  label: string | null;
  /** Materialized at read-time. Re-signed every list to avoid stale URLs. */
  signedUrl: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  agent_id: string | number;
  storage_path: string;
  public_url: string | null;
  kind: MediaKind;
  source: MediaSource;
  related_listing_id: string | null;
  file_name: string | null;
  content_type: string | null;
  size_bytes: number | null;
  label: string | null;
  created_at: string;
};

function rowToItem(r: Row, signedUrl: string | null): MediaItem {
  return {
    id: r.id,
    agentId: String(r.agent_id),
    storagePath: r.storage_path,
    kind: r.kind,
    source: r.source,
    relatedListingId: r.related_listing_id,
    fileName: r.file_name,
    contentType: r.content_type,
    sizeBytes: r.size_bytes,
    label: r.label,
    signedUrl,
    createdAt: r.created_at,
  };
}

/**
 * Lists an agent's library, newest first. Each row is decorated
 * with a fresh signed read URL — we issue them all in a single
 * bulk call (Supabase storage's `createSignedUrls` plural) so
 * a 30-item library doesn't fan out into 30 network requests.
 */
export async function listMediaForAgent(
  agentId: string,
  opts?: { limit?: number; kind?: MediaKind | null },
): Promise<MediaItem[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 200);

  let query = supabaseAdmin
    .from("media_library")
    .select(
      "id, agent_id, storage_path, public_url, kind, source, related_listing_id, file_name, content_type, size_bytes, label, created_at",
    )
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts?.kind) query = query.eq("kind", opts.kind);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return [];

  const paths = rows.map((r) => r.storage_path);
  const { data: signedData } = await supabaseAdmin.storage
    .from(LEAD_MEDIA_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  const signedByPath = new Map<string, string>();
  for (const s of signedData ?? []) {
    if (s.path && s.signedUrl) signedByPath.set(s.path, s.signedUrl);
  }

  return rows.map((r) => rowToItem(r, signedByPath.get(r.storage_path) ?? null));
}

/**
 * Single-item read by id with ownership check. Returns null when
 * not found or not owned by `agentId` (route handlers return 404
 * for both cases — never reveal that the row exists under a
 * different agent).
 */
export async function getMediaById(
  agentId: string,
  id: string,
): Promise<MediaItem | null> {
  const { data, error } = await supabaseAdmin
    .from("media_library")
    .select(
      "id, agent_id, storage_path, public_url, kind, source, related_listing_id, file_name, content_type, size_bytes, label, created_at",
    )
    .eq("id", id)
    .eq("agent_id", agentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as Row;
  const { data: signed } = await supabaseAdmin.storage
    .from(LEAD_MEDIA_BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
  return rowToItem(row, signed?.signedUrl ?? null);
}

/**
 * Upload a buffer to storage and create the metadata row. Caller
 * is responsible for size / MIME validation BEFORE this — keeps
 * the helper pure (single responsibility) and lets the route
 * return a more specific 400 with the friendly limit text the
 * agent saw on the picker.
 */
export async function uploadMedia(params: {
  agentId: string;
  bytes: Uint8Array;
  fileName: string;
  contentType: string;
  kind?: MediaKind;
  source?: MediaSource;
  label?: string | null;
  relatedListingId?: string | null;
}): Promise<MediaItem> {
  const {
    agentId,
    bytes,
    fileName,
    contentType,
    kind = "general",
    source = "upload",
    label = null,
    relatedListingId = null,
  } = params;

  const ext = (fileName.split(".").pop() || "").toLowerCase().slice(0, 8);
  // Always namespace by agent — keeps prefix-scoped listing / delete
  // cheap, and keeps a misissued service-role token from cross-
  // contaminating other agents' files via path collisions.
  const objectId = crypto.randomUUID();
  const storagePath = `${agentId}/${objectId}${ext ? `.${ext}` : ""}`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(LEAD_MEDIA_BUCKET)
    .upload(storagePath, bytes, {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadErr) {
    throw new Error(`Media upload failed: ${uploadErr.message}`);
  }

  const { data, error: insertErr } = await supabaseAdmin
    .from("media_library")
    .insert({
      agent_id: agentId,
      storage_path: storagePath,
      kind,
      source,
      related_listing_id: relatedListingId,
      file_name: fileName,
      content_type: contentType,
      size_bytes: bytes.byteLength,
      label,
    } as Record<string, unknown>)
    .select(
      "id, agent_id, storage_path, public_url, kind, source, related_listing_id, file_name, content_type, size_bytes, label, created_at",
    )
    .single();
  if (insertErr) {
    // Best-effort: clean up the orphaned storage object so we don't
    // leak bytes when the metadata insert fails (e.g. RLS edge case
    // or a check-constraint violation).
    try {
      await supabaseAdmin.storage.from(LEAD_MEDIA_BUCKET).remove([storagePath]);
    } catch {
      // ignore — we'd rather raise the original insert error than mask it
    }
    throw new Error(`Media metadata insert failed: ${insertErr.message}`);
  }

  const row = data as Row;
  const { data: signed } = await supabaseAdmin.storage
    .from(LEAD_MEDIA_BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
  return rowToItem(row, signed?.signedUrl ?? null);
}

/**
 * Delete a media item by id. Removes BOTH the storage object and
 * the metadata row. Idempotent — returns true on success / not-
 * found, throws only on a real DB / storage error.
 */
export async function deleteMedia(agentId: string, id: string): Promise<boolean> {
  // Load with ownership check first so we get the storage_path
  // and never delete another agent's row.
  const { data, error } = await supabaseAdmin
    .from("media_library")
    .select("id, storage_path")
    .eq("id", id)
    .eq("agent_id", agentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return true; // already gone — caller treats as success

  const row = data as { id: string; storage_path: string };
  // Storage removal is best-effort: even if the object is already
  // gone we want to delete the metadata row, so we don't gate the
  // delete on the storage call succeeding.
  try {
    await supabaseAdmin.storage
      .from(LEAD_MEDIA_BUCKET)
      .remove([row.storage_path]);
  } catch {
    // ignore — proceed to row delete
  }
  const { error: delErr } = await supabaseAdmin
    .from("media_library")
    .delete()
    .eq("id", row.id)
    .eq("agent_id", agentId);
  if (delErr) throw new Error(delErr.message);
  return true;
}
