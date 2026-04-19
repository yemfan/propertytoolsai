import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  detectIntentSignals,
  scoreBehavior,
  type BehaviorEvent,
} from "@/lib/contacts/behavior/scoring";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Nightly cron: recompute engagement_score + fire intent signals.
 *
 * Processing model:
 *   1. Find every contact with at least one event in the last 30 days
 *      (the scoring window). Ignoring idle contacts keeps the batch
 *      size bounded.
 *   2. For each, load events from the last 30 days.
 *   3. Run scoreBehavior() → write to contacts.engagement_score.
 *   4. Run detectIntentSignals() → upsert contact_signals rows for each
 *      proposal, deduped against existing un-dismissed signals by
 *      (contact_id, signal_type, dedup_key) stored in payload.dedup_key.
 *
 * Invoke:
 *   GET /api/cron/behavior-score              (Vercel cron, hourly or daily)
 *   GET /api/cron/behavior-score?agentId=123  (subset for debugging)
 *   GET /api/cron/behavior-score?contactId=uuid  (single contact re-score)
 *
 * Safety: CRON_SECRET via the `Authorization: Bearer <secret>` header or
 * the `x-vercel-cron-signature` Vercel sets automatically.
 */

const LOOKBACK_DAYS = 30;

function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get("authorization") ?? "";
  const vercelCron = req.headers.get("x-vercel-cron-signature");
  if (vercelCron) return true; // Vercel cron invocation
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}

type EventRow = {
  contact_id: string;
  event_type: string;
  created_at: string;
  payload: Record<string, unknown> | null;
};

async function processContact(contactId: string, now: Date): Promise<{
  scored: boolean;
  signalsCreated: number;
}> {
  const sinceIso = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: rawEvents, error: evErr } = await supabaseAdmin
    .from("contact_events")
    .select("contact_id,event_type,created_at,payload")
    .eq("contact_id", contactId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(500);
  if (evErr) throw evErr;

  const events: BehaviorEvent[] = ((rawEvents ?? []) as EventRow[]).map((r) => ({
    eventType: r.event_type,
    createdAt: r.created_at,
    payload: r.payload ?? {},
  }));

  // 1. Recompute score
  const { score, factors, computedAt } = scoreBehavior(events, { now });

  // 1a. Derive rating from score bucket. Skip the write if the agent
  // has pinned a manual rating — rating_manual_override=true signals
  // "trust me, the model is wrong for this one". Log rating changes to
  // contact_events so the UI can show the history of how a lead warmed
  // (or cooled) over time.
  const { data: contactRow } = await supabaseAdmin
    .from("contacts")
    .select("rating, rating_manual_override, agent_id")
    .eq("id", contactId)
    .maybeSingle();
  const currentRating = (contactRow as { rating?: string | null } | null)?.rating ?? null;
  const manualOverride = !!(contactRow as { rating_manual_override?: boolean } | null)?.rating_manual_override;
  const nextRating = ratingForScore(score);

  const update: Record<string, unknown> = {
    engagement_score: score,
    last_activity_at: events[0]?.createdAt ?? null,
  };
  if (!manualOverride && nextRating !== currentRating) {
    update.rating = nextRating;
  }

  await supabaseAdmin
    .from("contacts")
    .update(update as never)
    .eq("id", contactId);

  // Log the rating transition so agents can see when + why it changed.
  if (!manualOverride && nextRating !== currentRating) {
    const agentIdForEvent = (contactRow as { agent_id?: unknown } | null)?.agent_id ?? null;
    await supabaseAdmin.from("contact_events").insert({
      contact_id: contactId,
      agent_id: agentIdForEvent as never,
      event_type: "rating_changed",
      source: "cron",
      payload: {
        from: currentRating,
        to: nextRating,
        reason: "auto",
        engagement_score: score,
        model_version: "v1-behavior-decay-14d",
      } as never,
    } as never);
  }

  // Also write a contact_scores row so historical scores are queryable
  // (used by the trends UI later).
  await supabaseAdmin.from("contact_scores").insert({
    contact_id: contactId,
    score,
    label: score >= 60 ? "hot" : score >= 30 ? "warm" : "cold",
    factors: factors as never,
    model_version: "v1-behavior-decay-14d",
    computed_at: computedAt,
  } as never);

  // 2. Fire intent signals. Dedup against existing un-dismissed signals
  // using the dedup_key stored in payload.
  const proposals = detectIntentSignals(events, { now });
  if (proposals.length === 0) return { scored: true, signalsCreated: 0 };

  const dedupKeys = proposals.map((p) => p.dedupKey);
  const { data: existing } = await supabaseAdmin
    .from("contact_signals")
    .select("id,payload")
    .eq("contact_id", contactId)
    .is("dismissed_at", null)
    .in("signal_type", [...new Set(proposals.map((p) => p.signalType))]);
  const existingKeys = new Set<string>();
  for (const row of existing ?? []) {
    const key = (row as { payload?: { dedup_key?: unknown } }).payload?.dedup_key;
    if (typeof key === "string") existingKeys.add(key);
  }

  const toInsert = proposals
    .filter((p) => !existingKeys.has(p.dedupKey))
    .map((p) => ({
      contact_id: contactId,
      signal_type: p.signalType,
      label: p.label,
      confidence: p.confidence,
      suggested_action: p.suggestedAction,
      payload: { ...p.payload, dedup_key: p.dedupKey } as never,
      detected_at: now.toISOString(),
    }));

  if (toInsert.length > 0) {
    const { error: insErr } = await supabaseAdmin
      .from("contact_signals")
      .insert(toInsert as never);
    if (insErr) {
      console.error("[cron/behavior-score] signal insert failed", {
        code: (insErr as { code?: string }).code,
        msg: (insErr as { message?: string }).message,
      });
    }
  }

  return { scored: true, signalsCreated: toInsert.length };
  // Dedup note: the dedup check matches on the most recent un-dismissed
  // signal. Once the agent dismisses a signal, the next run can re-fire
  // the same dedup_key — which is intentional for signals like
  // high_intent_returning (the contact came back after going cold).
}

async function listCandidateContactIds(opts: { agentId?: string; contactId?: string }): Promise<string[]> {
  if (opts.contactId) return [opts.contactId];

  const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let q = supabaseAdmin
    .from("contact_events")
    .select("contact_id")
    .gte("created_at", sinceIso)
    .limit(10000);
  if (opts.agentId) q = q.eq("agent_id", opts.agentId as never);

  const { data, error } = await q;
  if (error) throw error;
  const set = new Set<string>();
  for (const row of data ?? []) {
    const id = (row as { contact_id?: string }).contact_id;
    if (id) set.add(String(id));
  }
  return Array.from(set);
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId") ?? undefined;
  const contactId = url.searchParams.get("contactId") ?? undefined;

  try {
    const now = new Date();
    const contactIds = await listCandidateContactIds({ agentId, contactId });

    let scored = 0;
    let signalsCreated = 0;
    let failed = 0;

    for (const cid of contactIds) {
      try {
        const r = await processContact(cid, now);
        if (r.scored) scored += 1;
        signalsCreated += r.signalsCreated;
      } catch (e) {
        failed += 1;
        console.error("[cron/behavior-score] per-contact failure", {
          contactId: cid,
          err: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      candidates: contactIds.length,
      scored,
      signalsCreated,
      failed,
      durationMs: Date.now() - now.getTime(),
    });
  } catch (e) {
    console.error("[cron/behavior-score] fatal", e);
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Server error",
      },
      { status: 500 },
    );
  }
}

/**
 * Engagement-score → rating letter. Thresholds tuned for the v1
 * weight table:
 *   70+ → A   (dense recent engagement: multiple favorites, alert
 *              clicks, saved searches — the "call them this week" tier)
 *   40-69 → B (real interest: repeat views, at least one strong
 *              signal — worth nurturing)
 *   20-39 → C (passive browsing — keep in drip, don't hand-work)
 *   <20  → D (dormant or cold)
 *
 * Recalibrate once real usage data tells us the distribution. Logging
 * every change to contact_events makes that analysis straightforward.
 */
function ratingForScore(score: number): "A" | "B" | "C" | "D" {
  if (score >= 70) return "A";
  if (score >= 40) return "B";
  if (score >= 20) return "C";
  return "D";
}
