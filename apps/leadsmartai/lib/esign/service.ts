import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { nextEnvelopeStatus } from "./statusMapping";
import type {
  EnvelopeStatus,
  ESignProvider,
  SignatureEnvelope,
  SignatureEventType,
  Signer,
} from "./types";
import type { ParsedProviderEvent } from "./providers/types";

/**
 * Server-side service layer for the e-signature surface.
 *
 * Read APIs (listForTransaction, listForContact, getEnvelope) use
 * the service-role client and bypass RLS — the caller has already
 * authorized the agent. Routes that hit this should validate
 * authorization themselves.
 *
 * Write APIs are minimal: `recordWebhookEvent` is the entire
 * write path. The actual `sendEnvelope` (per-provider API call)
 * stays out of this PR — it ships once provider creds are in
 * place and the create-envelope UI is built.
 */

export async function listForTransaction(
  transactionId: string,
): Promise<SignatureEnvelope[]> {
  const { data, error } = await supabaseAdmin
    .from("signature_envelopes")
    .select("*")
    .eq("transaction_id", transactionId)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[esign] listForTransaction failed:", error.message);
    return [];
  }
  return (data ?? []).map(mapRow);
}

export async function listForContact(
  contactId: string,
): Promise<SignatureEnvelope[]> {
  const { data, error } = await supabaseAdmin
    .from("signature_envelopes")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[esign] listForContact failed:", error.message);
    return [];
  }
  return (data ?? []).map(mapRow);
}

export async function getEnvelope(
  envelopeId: string,
): Promise<SignatureEnvelope | null> {
  const { data, error } = await supabaseAdmin
    .from("signature_envelopes")
    .select("*")
    .eq("id", envelopeId)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

/**
 * Persist a parsed provider event. Three steps:
 *   1. Locate the envelope by (provider, providerId)
 *   2. Insert the signature_events row (idempotent on
 *      external_event_id — duplicate webhook deliveries are
 *      rejected by the unique constraint, returned silently)
 *   3. Recompute envelope status using the pure mapper, update
 *      the envelope row + flip per-signer `signed` flags
 *
 * Returns the resolved envelope id so the route can include it
 * in the response. Returns null when the envelope doesn't exist
 * (provider sent a webhook for an envelope we never created,
 * e.g. agent created the envelope outside our app).
 */
export async function recordWebhookEvent(args: {
  provider: ESignProvider;
  parsed: ParsedProviderEvent;
}): Promise<{ envelopeId: string; status: EnvelopeStatus } | null> {
  const { data: envRow } = await supabaseAdmin
    .from("signature_envelopes")
    .select("id, status, signers, sent_at")
    .eq("provider", args.provider)
    .eq("provider_id", args.parsed.providerId)
    .maybeSingle();
  if (!envRow) return null;

  const env = envRow as {
    id: string;
    status: EnvelopeStatus;
    signers: unknown;
    sent_at: string | null;
  };
  const envelopeId = env.id;
  const occurredAt = args.parsed.occurredAt ?? new Date().toISOString();

  // 1. Append event row (idempotent).
  const { error: insertErr } = await supabaseAdmin
    .from("signature_events")
    .insert({
      envelope_id: envelopeId,
      external_event_id: args.parsed.externalEventId,
      event_type: args.parsed.eventType,
      signer_index: args.parsed.signerIndex,
      payload: args.parsed,
      occurred_at: occurredAt,
    });
  if (insertErr && (insertErr as { code?: string }).code !== "23505") {
    console.warn("[esign] event insert failed:", insertErr.message);
  }

  // 2. Recompute envelope status. For 'signed' events we also
  //    flip the per-signer flag in the JSONB array.
  const signers = parseSigners(env.signers);
  if (
    args.parsed.eventType === "signed" &&
    args.parsed.signerIndex != null &&
    signers[args.parsed.signerIndex]
  ) {
    signers[args.parsed.signerIndex] = {
      ...signers[args.parsed.signerIndex],
      signed: true,
      signedAt: occurredAt,
    };
  }
  const allSigned = signers.length > 0 && signers.every((s) => s.signed);

  const newStatus = nextEnvelopeStatus({
    current: env.status,
    event: args.parsed.eventType as SignatureEventType,
    allSigned,
  });

  const patch: Record<string, unknown> = {};
  if (newStatus !== env.status) patch.status = newStatus;
  patch.signers = signers;
  if (newStatus === "completed" && env.status !== "completed") {
    patch.completed_at = occurredAt;
  }

  if (Object.keys(patch).length > 0) {
    await supabaseAdmin.from("signature_envelopes").update(patch).eq("id", envelopeId);
  }

  return { envelopeId, status: newStatus };
}

// ── row mappers ─────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): SignatureEnvelope {
  return {
    id: String(row.id ?? ""),
    agentId: String(row.agent_id ?? ""),
    contactId: (row.contact_id as string | null) ?? null,
    transactionId: (row.transaction_id as string | null) ?? null,
    provider: (row.provider as ESignProvider) ?? "dotloop",
    providerId: String(row.provider_id ?? ""),
    status: (row.status as EnvelopeStatus) ?? "sent",
    subject: String(row.subject ?? ""),
    signers: parseSigners(row.signers),
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
    sentAt: (row.sent_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function parseSigners(raw: unknown): Signer[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s, i): Signer | null => {
      if (!s || typeof s !== "object") return null;
      const r = s as Record<string, unknown>;
      return {
        index: typeof r.index === "number" ? r.index : i,
        name: String(r.name ?? ""),
        email: String(r.email ?? ""),
        signed: Boolean(r.signed),
        signedAt: (r.signedAt as string | null) ?? null,
      };
    })
    .filter((s): s is Signer => s !== null);
}
