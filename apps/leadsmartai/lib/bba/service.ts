import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { canShowProperty, type BbaInput, type BbaStatus } from "./status";

/**
 * Server-side service for buyer-broker agreements.
 *
 * Bypasses RLS via the service-role client because routes
 * authorize the calling agent before invoking. Three main flows:
 *   1. createDraft — agent starts a new BBA for a contact
 *   2. attachSignatureEnvelope — agent sends through e-sign
 *      (#199/#201); this links the envelope id and flips status
 *      to 'sent'
 *   3. markSigned — webhook handler (or manual override) flips
 *      to 'signed' and stamps signed_at
 *
 * Plus the gate query: `getActiveForContact` returns the latest
 * usable BBA, used by the showing scheduler / transaction
 * creation flow.
 */

export type BuyerBrokerAgreement = {
  id: string;
  agentId: string;
  contactId: string;
  stateCode: string | null;
  status: BbaStatus;
  isExclusive: boolean;
  buyerCommissionPct: number | null;
  flatFeeAmount: number | null;
  effectiveStartDate: string | null;
  effectiveEndDate: string | null;
  signedAt: string | null;
  terminatedAt: string | null;
  terminatedReason: string | null;
  signatureEnvelopeId: string | null;
  pdfUrl: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export async function createDraft(args: {
  agentId: string;
  contactId: string;
  stateCode?: string | null;
  isExclusive?: boolean;
  buyerCommissionPct?: number | null;
  flatFeeAmount?: number | null;
  effectiveStartDate?: string | null;
  effectiveEndDate?: string | null;
}): Promise<BuyerBrokerAgreement> {
  const { data, error } = await supabaseAdmin
    .from("buyer_broker_agreements")
    .insert({
      agent_id: args.agentId,
      contact_id: args.contactId,
      state_code: args.stateCode?.toUpperCase() ?? null,
      status: "draft",
      is_exclusive: args.isExclusive ?? true,
      buyer_commission_pct: args.buyerCommissionPct ?? null,
      flat_fee_amount: args.flatFeeAmount ?? null,
      effective_start_date: args.effectiveStartDate ?? null,
      effective_end_date: args.effectiveEndDate ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create BBA");
  return mapRow(data as Record<string, unknown>);
}

export async function listForAgent(
  agentId: string,
): Promise<BuyerBrokerAgreement[]> {
  const { data } = await supabaseAdmin
    .from("buyer_broker_agreements")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function listForContact(
  contactId: string,
): Promise<BuyerBrokerAgreement[]> {
  const { data } = await supabaseAdmin
    .from("buyer_broker_agreements")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function getById(
  id: string,
): Promise<BuyerBrokerAgreement | null> {
  const { data } = await supabaseAdmin
    .from("buyer_broker_agreements")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? mapRow(data as Record<string, unknown>) : null;
}

/**
 * Gate query for the showing scheduler / transaction creation
 * flow. Returns the most-recently-signed usable BBA for this
 * contact, or null when none qualify.
 *
 * "Usable" via canShowProperty — signed + not terminated + not
 * past expiry.
 */
export async function getActiveForContact(args: {
  contactId: string;
  nowIso?: string;
}): Promise<BuyerBrokerAgreement | null> {
  const nowIso = args.nowIso ?? new Date().toISOString();
  const { data } = await supabaseAdmin
    .from("buyer_broker_agreements")
    .select("*")
    .eq("contact_id", args.contactId)
    .eq("status", "signed")
    .order("signed_at", { ascending: false })
    .limit(20);

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const bba = mapRow(row);
    const usable = canShowProperty(toBbaInput(bba), nowIso);
    if (usable) return bba;
  }
  return null;
}

/**
 * Link the e-sign envelope (created via PR-AF #201's service)
 * to this BBA and flip status to 'sent'.
 */
export async function attachSignatureEnvelope(args: {
  bbaId: string;
  envelopeId: string;
}): Promise<BuyerBrokerAgreement | null> {
  const { data } = await supabaseAdmin
    .from("buyer_broker_agreements")
    .update({
      signature_envelope_id: args.envelopeId,
      status: "sent",
    })
    .eq("id", args.bbaId)
    .select("*")
    .single();
  return data ? mapRow(data as Record<string, unknown>) : null;
}

/**
 * Flip a sent BBA to 'signed'. Called by the e-sign webhook
 * downstream when the envelope hits 'completed', or by a manual
 * agent override.
 */
export async function markSigned(args: {
  bbaId: string;
  signedAt?: string;
  effectiveStartDate?: string | null;
  effectiveEndDate?: string | null;
}): Promise<BuyerBrokerAgreement | null> {
  const patch: Record<string, unknown> = {
    status: "signed",
    signed_at: args.signedAt ?? new Date().toISOString(),
  };
  if (args.effectiveStartDate !== undefined) {
    patch.effective_start_date = args.effectiveStartDate;
  }
  if (args.effectiveEndDate !== undefined) {
    patch.effective_end_date = args.effectiveEndDate;
  }
  const { data } = await supabaseAdmin
    .from("buyer_broker_agreements")
    .update(patch)
    .eq("id", args.bbaId)
    .select("*")
    .single();
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function terminate(args: {
  bbaId: string;
  reason?: string | null;
}): Promise<BuyerBrokerAgreement | null> {
  const { data } = await supabaseAdmin
    .from("buyer_broker_agreements")
    .update({
      status: "terminated",
      terminated_at: new Date().toISOString(),
      terminated_reason: args.reason ?? null,
    })
    .eq("id", args.bbaId)
    .select("*")
    .single();
  return data ? mapRow(data as Record<string, unknown>) : null;
}

// ── helpers ─────────────────────────────────────────────────────

function toBbaInput(bba: BuyerBrokerAgreement): BbaInput {
  return {
    status: bba.status,
    signedAt: bba.signedAt,
    effectiveStartDate: bba.effectiveStartDate,
    effectiveEndDate: bba.effectiveEndDate,
    terminatedAt: bba.terminatedAt,
  };
}

function mapRow(row: Record<string, unknown>): BuyerBrokerAgreement {
  return {
    id: String(row.id ?? ""),
    agentId: String(row.agent_id ?? ""),
    contactId: String(row.contact_id ?? ""),
    stateCode: (row.state_code as string | null) ?? null,
    status: (row.status as BbaStatus) ?? "draft",
    isExclusive: Boolean(row.is_exclusive ?? true),
    buyerCommissionPct: parseNum(row.buyer_commission_pct),
    flatFeeAmount: parseNum(row.flat_fee_amount),
    effectiveStartDate: (row.effective_start_date as string | null) ?? null,
    effectiveEndDate: (row.effective_end_date as string | null) ?? null,
    signedAt: (row.signed_at as string | null) ?? null,
    terminatedAt: (row.terminated_at as string | null) ?? null,
    terminatedReason: (row.terminated_reason as string | null) ?? null,
    signatureEnvelopeId: (row.signature_envelope_id as string | null) ?? null,
    pdfUrl: (row.pdf_url as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function parseNum(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
