import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  computeWatchPct,
  isCountableView,
} from "./analytics";
import {
  generateVideoToken,
  hashIp,
  hashVideoToken,
} from "./token";

/**
 * Server-side service for video messages.
 *
 * Bypasses RLS via the service-role client because routes
 * authorize before invoking. Three flows:
 *   - createMessage — agent finishes recording / uploading;
 *     row is inserted with a fresh share token
 *   - loadByShareToken — public viewer lookup
 *   - recordView — public viewer player ticks; updates the
 *     parent row's counters and inserts a view log row when
 *     the watch quality is high enough to count
 */

export type VideoMessage = {
  id: string;
  agentId: string;
  contactId: string | null;
  title: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  isPublished: boolean;
  viewCount: number;
  uniqueViewCount: number;
  lastViewedAt: string | null;
  sentToEmail: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function createMessage(args: {
  agentId: string;
  contactId?: string | null;
  title?: string;
  videoUrl: string;
  thumbnailUrl?: string | null;
  durationSeconds: number;
}): Promise<{ message: VideoMessage; rawToken: string }> {
  const { rawToken, tokenHash } = generateVideoToken();
  const { data, error } = await supabaseAdmin
    .from("video_messages")
    .insert({
      agent_id: args.agentId,
      contact_id: args.contactId ?? null,
      title: (args.title ?? "").trim(),
      video_url: args.videoUrl,
      thumbnail_url: args.thumbnailUrl ?? null,
      duration_seconds: Math.max(0, Math.round(args.durationSeconds)),
      share_token_hash: tokenHash,
      is_published: true,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create video message");
  }
  return { message: mapRow(data as Record<string, unknown>), rawToken };
}

export async function listForAgent(
  agentId: string,
): Promise<VideoMessage[]> {
  const { data } = await supabaseAdmin
    .from("video_messages")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

/**
 * Public viewer lookup. Returns null on unknown token OR when the
 * agent has unpublished the message (e.g. archived). The route
 * collapses both to a 404 page.
 */
export async function loadByShareToken(
  rawToken: string,
): Promise<VideoMessage | null> {
  const tokenHash = hashVideoToken(rawToken);
  const { data } = await supabaseAdmin
    .from("video_messages")
    .select("*")
    .eq("share_token_hash", tokenHash)
    .maybeSingle();
  if (!data) return null;
  const m = mapRow(data as Record<string, unknown>);
  if (!m.isPublished) return null;
  return m;
}

/**
 * Player heartbeat — called as the viewer's `<video>` element
 * progresses. Updates the row's counters when the watch is
 * "real" (per isCountableView), and always logs the view to
 * video_message_views for forensics.
 *
 * `unique_view_count` increments only when this IP hash hasn't
 * been seen for this video before.
 */
export async function recordView(args: {
  rawToken: string;
  watchedSeconds: number;
  /** Caller resolves the viewer IP from request headers. */
  viewerIp?: string | null;
  userAgent?: string | null;
}): Promise<{ ok: boolean; counted: boolean }> {
  const tokenHash = hashVideoToken(args.rawToken);

  // Resolve the video.
  const { data: row } = await supabaseAdmin
    .from("video_messages")
    .select("id, duration_seconds, view_count, unique_view_count, is_published")
    .eq("share_token_hash", tokenHash)
    .maybeSingle();
  if (!row) return { ok: false, counted: false };
  const r = row as {
    id: string;
    duration_seconds: number;
    view_count: number;
    unique_view_count: number;
    is_published: boolean;
  };
  if (!r.is_published) return { ok: false, counted: false };

  const watchPct = computeWatchPct(r.duration_seconds, args.watchedSeconds);
  const ipHash = hashIp(args.viewerIp ?? null);

  // Always log the view event for forensics.
  await supabaseAdmin.from("video_message_views").insert({
    video_id: r.id,
    ip_hash: ipHash,
    user_agent: args.userAgent ?? null,
    watch_pct: watchPct,
    watched_seconds: Math.max(0, Math.round(args.watchedSeconds)),
  });

  if (!isCountableView({ watchPct, watchedSeconds: args.watchedSeconds })) {
    return { ok: true, counted: false };
  }

  // Increment counters. unique_view_count only bumps when this
  // ipHash hasn't been seen before for this video.
  let isUnique = false;
  if (ipHash) {
    const { count } = await supabaseAdmin
      .from("video_message_views")
      .select("id", { count: "exact", head: true })
      .eq("video_id", r.id)
      .eq("ip_hash", ipHash);
    // The view we just inserted is in the count, so a unique
    // viewer has count===1.
    isUnique = (count ?? 0) <= 1;
  }

  await supabaseAdmin
    .from("video_messages")
    .update({
      view_count: r.view_count + 1,
      unique_view_count: r.unique_view_count + (isUnique ? 1 : 0),
      last_viewed_at: new Date().toISOString(),
    })
    .eq("id", r.id);

  return { ok: true, counted: true };
}

function mapRow(row: Record<string, unknown>): VideoMessage {
  return {
    id: String(row.id ?? ""),
    agentId: String(row.agent_id ?? ""),
    contactId: (row.contact_id as string | null) ?? null,
    title: String(row.title ?? ""),
    videoUrl: String(row.video_url ?? ""),
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    durationSeconds: Number(row.duration_seconds ?? 0),
    isPublished: Boolean(row.is_published ?? true),
    viewCount: Number(row.view_count ?? 0),
    uniqueViewCount: Number(row.unique_view_count ?? 0),
    lastViewedAt: (row.last_viewed_at as string | null) ?? null,
    sentToEmail: (row.sent_to_email as string | null) ?? null,
    sentAt: (row.sent_at as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}
