import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { InboundIntent } from "./intent";
import type { ParsedOffer } from "@/lib/offers/parsedShape";
import type { ListingAgreementExtraction } from "@/lib/transactions/extractContract";

/**
 * Inbound email delivery storage layer (Phase 2).
 *
 * Each forwarded email creates a `inbound_email_deliveries` row that
 * binds together:
 *   - the alias we routed through
 *   - the envelope (from / to / subject / body preview)
 *   - the attachment list (Resend's signed content_urls)
 *   - the extracted structured fields (ParsedOffer or RLA shape) when
 *     we successfully ran an AI extractor against a PDF
 *   - the "Review forwarded …" task we created in the agent's queue
 *
 * The review page (/dashboard/inbound/[id]) reads this row to render
 * the parsed fields and link out to the offer/listing upload screens
 * pre-filled with the extraction.
 */

export type InboundExtractionStatus = "pending" | "extracted" | "failed" | "skipped";

export type InboundAttachmentMeta = {
  filename: string | null;
  content_type: string | null;
  content_url: string | null;
};

/**
 * Discriminated extraction shape — each intent that has a structured
 * extractor stores the matching payload here. `unknown` and
 * `showing_requested` deliveries store no extraction (status is
 * 'skipped' for those — we still surface the email body for the
 * agent to copy/paste).
 */
export type InboundExtractionPayload =
  | { kind: "offer"; data: ParsedOffer }
  | { kind: "listing_agreement"; data: ListingAgreementExtraction };

export type InboundDeliveryRow = {
  id: string;
  alias_id: string;
  agent_id: string;
  task_id: string | null;
  resend_message_id: string | null;
  intent: InboundIntent;
  from_header: string | null;
  to_header: string | null;
  subject: string | null;
  text_preview: string | null;
  attachments_json: InboundAttachmentMeta[] | null;
  extraction_status: InboundExtractionStatus;
  extraction: InboundExtractionPayload | null;
  extraction_error: string | null;
  extracted_at: string | null;
  created_at: string;
};

export type CreateInboundDeliveryInput = {
  aliasId: string;
  agentId: string;
  resendMessageId: string | null;
  intent: InboundIntent;
  fromHeader: string | null;
  toHeader: string | null;
  subject: string | null;
  textPreview: string | null;
  attachments: InboundAttachmentMeta[];
  extractionStatus: InboundExtractionStatus;
  extraction: InboundExtractionPayload | null;
  extractionError: string | null;
};

export async function createInboundDelivery(
  input: CreateInboundDeliveryInput,
): Promise<InboundDeliveryRow> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("inbound_email_deliveries")
    .insert({
      alias_id: input.aliasId as any,
      agent_id: input.agentId as any,
      resend_message_id: input.resendMessageId,
      intent: input.intent,
      from_header: input.fromHeader,
      to_header: input.toHeader,
      subject: input.subject,
      text_preview: input.textPreview,
      attachments_json: input.attachments as any,
      extraction_status: input.extractionStatus,
      extraction: input.extraction as any,
      extraction_error: input.extractionError,
      extracted_at: input.extractionStatus === "extracted" ? nowIso : null,
    } as any)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create inbound delivery row");
  }
  return data as InboundDeliveryRow;
}

/**
 * Late-binding the task_id once `createTask` has returned. Done as a
 * separate update so a task-creation failure doesn't roll back the
 * delivery row — we'd rather have the delivery on file (so the agent
 * can still see the inbound email via the dashboard list) than a
 * clean ledger.
 */
export async function setInboundDeliveryTaskId(
  deliveryId: string,
  taskId: string,
): Promise<void> {
  await supabaseAdmin
    .from("inbound_email_deliveries")
    .update({ task_id: taskId as any } as any)
    .eq("id", deliveryId as any);
}

export async function getInboundDeliveryForAgent(
  agentId: string,
  id: string,
): Promise<InboundDeliveryRow | null> {
  const { data, error } = await supabaseAdmin
    .from("inbound_email_deliveries")
    .select("*")
    .eq("agent_id", agentId as any)
    .eq("id", id as any)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as InboundDeliveryRow | null) ?? null;
}

export type UpdateInboundExtractionInput =
  | {
      status: "extracted";
      extraction: InboundExtractionPayload;
      error?: never;
    }
  | {
      status: "failed";
      extraction?: never;
      error: string;
    }
  | {
      status: "skipped" | "pending";
      extraction?: never;
      error?: never;
    };

/** Update extraction state. Used by the webhook (initial run) and by
 *  the retry endpoint when the agent clicks "Try again" on the review
 *  page after a transient extractor failure. */
export async function updateInboundExtraction(
  deliveryId: string,
  input: UpdateInboundExtractionInput,
): Promise<void> {
  const patch: Record<string, unknown> = {
    extraction_status: input.status,
  };
  if (input.status === "extracted") {
    patch.extraction = input.extraction;
    patch.extraction_error = null;
    patch.extracted_at = new Date().toISOString();
  } else if (input.status === "failed") {
    patch.extraction_error = input.error.slice(0, 1000);
  } else {
    patch.extraction = null;
    patch.extraction_error = null;
  }

  const { error } = await supabaseAdmin
    .from("inbound_email_deliveries")
    .update(patch as any)
    .eq("id", deliveryId as any);
  if (error) throw new Error(error.message);
}
