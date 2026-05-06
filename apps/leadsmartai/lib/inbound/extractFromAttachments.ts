import "server-only";

import { extractOfferFromPdf } from "@/lib/offers/extractOfferFromPdf";
import { extractListingAgreement } from "@/lib/transactions/extractContract";
import type { InboundIntent } from "./intent";
import type {
  InboundAttachmentMeta,
  InboundExtractionPayload,
} from "./deliveries";

/**
 * Bridge between the inbound-email pipeline and the existing PDF
 * extractors:
 *   - offer_received       → extractOfferFromPdf (ParsedOffer)
 *   - listing_signed       → extractListingAgreement (RLA shape)
 *   - showing_requested    → no structured extractor today
 *   - unknown              → no extractor (we don't guess)
 *
 * Pulled out of the webhook so the retry endpoint can call the same
 * code path against an already-stored delivery row.
 */

const PDF_FETCH_TIMEOUT_MS = 30_000;
const MAX_PDF_BYTES = 8 * 1024 * 1024;

export type AttemptExtractionResult =
  | { status: "extracted"; payload: InboundExtractionPayload }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

function pickFirstPdfAttachment(
  attachments: InboundAttachmentMeta[],
): InboundAttachmentMeta | null {
  for (const a of attachments) {
    const ct = (a.content_type ?? "").toLowerCase();
    const fn = (a.filename ?? "").toLowerCase();
    if (ct.includes("pdf") || fn.endsWith(".pdf")) return a;
  }
  return null;
}

async function fetchAttachmentBytes(url: string): Promise<Uint8Array> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PDF_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`PDF fetch failed: ${res.status} ${res.statusText}`);
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_PDF_BYTES) {
      throw new Error(
        `PDF too large (${Math.round(buf.byteLength / 1024 / 1024)} MB); max ${MAX_PDF_BYTES / 1024 / 1024} MB`,
      );
    }
    return new Uint8Array(buf);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run extraction for one delivery. Always resolves — failures come
 * back as {status:"failed"} with an error string the review page can
 * surface. Throwing here would cause Resend to retry the whole webhook,
 * which is wasteful: the delivery is already stored, we just want to
 * mark extraction failed and move on.
 */
export async function attemptExtraction(input: {
  intent: InboundIntent;
  attachments: InboundAttachmentMeta[];
}): Promise<AttemptExtractionResult> {
  const { intent, attachments } = input;

  // Showing requests + unknowns: no structured extractor. The agent
  // reads the email body on the review page and creates the showing
  // / clarifies the email manually.
  if (intent === "showing_requested" || intent === "unknown") {
    return { status: "skipped", reason: `intent=${intent}` };
  }

  const pdf = pickFirstPdfAttachment(attachments);
  if (!pdf || !pdf.content_url) {
    return { status: "skipped", reason: "no pdf attachment" };
  }

  let bytes: Uint8Array;
  try {
    bytes = await fetchAttachmentBytes(pdf.content_url);
  } catch (e) {
    return {
      status: "failed",
      error: e instanceof Error ? e.message : "PDF fetch failed",
    };
  }

  try {
    if (intent === "offer_received") {
      const data = await extractOfferFromPdf(bytes);
      return { status: "extracted", payload: { kind: "offer", data } };
    }
    if (intent === "listing_signed") {
      const data = await extractListingAgreement(bytes);
      return {
        status: "extracted",
        payload: { kind: "listing_agreement", data },
      };
    }
    return { status: "skipped", reason: `no extractor for intent=${intent}` };
  } catch (e) {
    return {
      status: "failed",
      error: e instanceof Error ? e.message : "Extractor crashed",
    };
  }
}

/**
 * One-line summary of an extraction payload, used to upgrade the task
 * title from "Review forwarded offer: <subject>" to
 * "Review forwarded offer: $750k @ 123 Main St" so the agent can
 * triage from the task list without opening the review page.
 */
export function summarizeExtraction(
  payload: InboundExtractionPayload,
): string | null {
  if (payload.kind === "offer") {
    const o = payload.data;
    const parts: string[] = [];
    if (o.offerPrice != null) {
      parts.push(
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(o.offerPrice),
      );
    }
    if (o.propertyAddress) parts.push(o.propertyAddress);
    return parts.length ? parts.join(" @ ") : null;
  }
  if (payload.kind === "listing_agreement") {
    const l = payload.data;
    const parts: string[] = [];
    if (l.listPrice != null) {
      parts.push(
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(l.listPrice),
      );
    }
    if (l.propertyAddress) parts.push(l.propertyAddress);
    return parts.length ? parts.join(" @ ") : null;
  }
  return null;
}
