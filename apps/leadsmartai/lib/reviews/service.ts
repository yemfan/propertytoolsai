import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { isEligibleForReviewRequest } from "./eligibility";
import {
  computeReviewExpiresAt,
  generateReviewToken,
  hashReviewToken,
  isReviewRequestUsable,
} from "./token";

/**
 * Server-side service for the review-request system.
 *
 * - `createReviewRequest` — creates a pending request after
 *   eligibility check. Returns the raw token so the caller (cron
 *   job, agent action) can include it in the outbound email/SMS
 * - `recordResponse(rawToken, payload)` — public landing page
 *   submit handler. Hashes the inbound token, validates it's
 *   usable, marks responded_at, optionally inserts a testimonial
 * - `recordGoogleClick(rawToken)` — landing page tracks when the
 *   user clicked through to leave a Google review (separately
 *   from filling out the private testimonial form)
 *
 * No real-Stripe / real-email side effects — this layer just
 * persists. The caller wires up the email send.
 */

export type CreateReviewRequestArgs = {
  agentId: string;
  contactId: string | null;
  transactionId: string | null;
  /** Pulled from the agent's profile — where the public landing
   *  page redirects when the client clicks "Leave a Google review". */
  googleReviewUrl: string | null;
  /** Override "now" for tests. */
  nowIso?: string;
  /** TTL override; clamped 7..180 days by token.ts. */
  ttlDays?: number;
};

export async function createReviewRequest(
  args: CreateReviewRequestArgs,
): Promise<{ requestId: string; rawToken: string }> {
  const nowIso = args.nowIso ?? new Date().toISOString();
  const expiresAt = computeReviewExpiresAt({ nowIso, days: args.ttlDays });
  const { rawToken, tokenHash } = generateReviewToken();

  const { data, error } = await supabaseAdmin
    .from("review_requests")
    .insert({
      agent_id: args.agentId,
      contact_id: args.contactId,
      transaction_id: args.transactionId,
      token_hash: tokenHash,
      google_review_url: args.googleReviewUrl,
      sent_at: nowIso,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create review request");
  }

  return {
    requestId: String((data as { id: string }).id),
    rawToken,
  };
}

/**
 * Cron-friendly variant: pre-checks eligibility against the
 * current transaction state + existence of a prior request, then
 * creates iff eligible. Useful for the daily "find newly-closed
 * transactions and ask for reviews" loop.
 */
export async function maybeCreateForTransaction(args: {
  agentId: string;
  contactId: string | null;
  transactionId: string;
  googleReviewUrl: string | null;
  nowIso?: string;
}): Promise<
  | { ok: true; requestId: string; rawToken: string }
  | { ok: false; reason: string }
> {
  const nowIso = args.nowIso ?? new Date().toISOString();

  // Load the transaction + check for prior request in parallel.
  const [{ data: txRow }, { data: priorRow }] = await Promise.all([
    supabaseAdmin
      .from("transactions")
      .select("id, status, closing_date_actual")
      .eq("id", args.transactionId)
      .maybeSingle(),
    supabaseAdmin
      .from("review_requests")
      .select("id")
      .eq("transaction_id", args.transactionId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (!txRow) return { ok: false, reason: "transaction_not_found" };

  const transaction = {
    id: String((txRow as { id: string }).id),
    status: String((txRow as { status: string }).status),
    closingDateActual:
      (txRow as { closing_date_actual: string | null }).closing_date_actual ?? null,
  };

  const verdict = isEligibleForReviewRequest({
    transaction,
    alreadyRequested: Boolean(priorRow),
    nowIso,
  });
  if (!verdict.eligible) {
    // tsconfig.strict:false here doesn't narrow the discriminated
    // union; cast to the failure half explicitly.
    const failure = verdict as Extract<typeof verdict, { eligible: false }>;
    return { ok: false, reason: failure.reason };
  }

  const created = await createReviewRequest({
    agentId: args.agentId,
    contactId: args.contactId,
    transactionId: args.transactionId,
    googleReviewUrl: args.googleReviewUrl,
    nowIso,
  });
  return { ok: true, ...created };
}

/**
 * Public landing-page submit. The visitor pasted the raw token
 * from their email; we hash and look up.
 */
export async function recordResponse(args: {
  rawToken: string;
  rating?: number | null;
  body?: string;
  authorName?: string | null;
  authorTitle?: string | null;
  nowIso?: string;
}): Promise<
  | { ok: true; testimonialId: string | null }
  | { ok: false; reason: "not_found" | "expired" | "already_responded" }
> {
  const nowIso = args.nowIso ?? new Date().toISOString();
  const tokenHash = hashReviewToken(args.rawToken);

  const { data: req } = await supabaseAdmin
    .from("review_requests")
    .select("id, agent_id, contact_id, transaction_id, expires_at, responded_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!req) return { ok: false, reason: "not_found" };

  const r = req as {
    id: string;
    agent_id: string;
    contact_id: string | null;
    transaction_id: string | null;
    expires_at: string;
    responded_at: string | null;
  };

  if (r.responded_at) return { ok: false, reason: "already_responded" };
  if (
    !isReviewRequestUsable({
      expiresAt: r.expires_at,
      respondedAt: r.responded_at,
      nowIso,
    })
  ) {
    return { ok: false, reason: "expired" };
  }

  // Mark the request responded.
  await supabaseAdmin
    .from("review_requests")
    .update({ responded_at: nowIso })
    .eq("id", r.id);

  // Insert a testimonial when the visitor left one (rating or body).
  const hasContent =
    (args.rating != null && Number.isFinite(args.rating)) ||
    (args.body && args.body.trim().length > 0);
  if (!hasContent) {
    return { ok: true, testimonialId: null };
  }

  const { data: ins } = await supabaseAdmin
    .from("testimonials")
    .insert({
      agent_id: r.agent_id,
      contact_id: r.contact_id,
      transaction_id: r.transaction_id,
      request_id: r.id,
      rating: args.rating ?? null,
      body: (args.body ?? "").trim(),
      author_name: args.authorName?.trim() || null,
      author_title: args.authorTitle?.trim() || null,
      is_published: false,
    })
    .select("id")
    .single();

  return { ok: true, testimonialId: ins ? String((ins as { id: string }).id) : null };
}

export async function recordGoogleClick(rawToken: string): Promise<boolean> {
  const tokenHash = hashReviewToken(rawToken);
  const { data: req } = await supabaseAdmin
    .from("review_requests")
    .select("id, clicked_google_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!req) return false;
  const r = req as { id: string; clicked_google_at: string | null };
  if (r.clicked_google_at) return true; // idempotent
  await supabaseAdmin
    .from("review_requests")
    .update({ clicked_google_at: new Date().toISOString() })
    .eq("id", r.id);
  return true;
}
