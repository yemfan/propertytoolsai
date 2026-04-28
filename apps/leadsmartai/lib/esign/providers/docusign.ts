/**
 * DocuSign webhook parser (Connect events).
 *
 * DocuSign's payload shape:
 *   {
 *     "event": "envelope-completed",
 *     "uri": "/restapi/v2.1/...",
 *     "data": {
 *       "envelopeId": "abc-123",
 *       "envelopeSummary": { ... },
 *       "recipientId"?: "1"
 *     },
 *     "generatedDateTime": "2026-04-28T..."
 *   }
 *
 * Signature: DocuSign Connect signs with HMAC-SHA256 in
 * `X-DocuSign-Signature-1`, base64-encoded. Multi-key rotation is
 * supported via additional `X-DocuSign-Signature-N` headers.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { mapProviderEventType } from "../statusMapping";
import type { ParsedProviderEvent, ProviderParser } from "./types";

export const docusignParser: ProviderParser = {
  verifySignature({ rawBody, headers }) {
    const secret = process.env.DOCUSIGN_WEBHOOK_SECRET?.trim();
    if (!secret) return true;

    // DocuSign emits multiple sigs during key rotation. Try each.
    const sigs: string[] = [];
    for (const [k, v] of Object.entries(headers)) {
      if (/^x-docusign-signature-\d+$/i.test(k) && typeof v === "string") {
        sigs.push(v);
      }
    }
    if (sigs.length === 0) return false;

    const expected = createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");
    return sigs.some((s) => constantTimeMatch(expected, s));
  },

  parseEvent(payload) {
    if (!payload || typeof payload !== "object") return null;
    const p = payload as Record<string, unknown>;
    const rawEvent = typeof p.event === "string" ? p.event : "";
    const eventType = mapProviderEventType("docusign", rawEvent);
    if (!eventType) return null;

    const data = (p.data as Record<string, unknown> | null) ?? null;
    const providerId =
      data && typeof data.envelopeId === "string" ? data.envelopeId : "";
    if (!providerId) return null;

    const recipientId = data && typeof data.recipientId === "string" ? data.recipientId : null;
    // DocuSign recipientIds are 1-based strings; convert to 0-based int.
    const signerIndex = recipientId != null ? Number(recipientId) - 1 : null;
    const safeIndex =
      typeof signerIndex === "number" && Number.isFinite(signerIndex) && signerIndex >= 0
        ? signerIndex
        : null;

    const occurredAt =
      typeof p.generatedDateTime === "string" ? p.generatedDateTime : null;

    return {
      providerId,
      externalEventId: typeof p.uri === "string" ? p.uri : null,
      eventType,
      signerIndex: safeIndex,
      occurredAt,
    };
  },
};

function constantTimeMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}
