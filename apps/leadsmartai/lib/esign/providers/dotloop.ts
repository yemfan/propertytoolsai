/**
 * Dotloop webhook parser.
 *
 * Dotloop's webhook payload (simplified):
 *   {
 *     "event": "loop.completed",
 *     "eventId": "evt_abc",
 *     "occurredAt": "2026-04-28T...",
 *     "loop": { "id": "loop_abc", "name": "..." },
 *     "participant"?: { "index": 0, "email": "..." }  // for per-signer events
 *   }
 *
 * Signature: Dotloop signs payloads with `X-Dotloop-Signature`,
 * an HMAC-SHA256 of the raw body keyed by the partner secret. We
 * skip verification when DOTLOOP_WEBHOOK_SECRET is unset (local
 * dev), and we will be safe in production once it's configured.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { mapProviderEventType } from "../statusMapping";
import type { ParsedProviderEvent, ProviderParser } from "./types";

export const dotloopParser: ProviderParser = {
  verifySignature({ rawBody, headers }) {
    const secret = process.env.DOTLOOP_WEBHOOK_SECRET?.trim();
    if (!secret) return true; // dev / unconfigured: accept

    const headerName = Object.keys(headers).find(
      (k) => k.toLowerCase() === "x-dotloop-signature",
    );
    const signature = headerName ? headers[headerName] : null;
    if (!signature) return false;

    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    return constantTimeMatch(expected, signature);
  },

  parseEvent(payload) {
    if (!payload || typeof payload !== "object") return null;
    const p = payload as Record<string, unknown>;
    const rawEvent = typeof p.event === "string" ? p.event : "";
    const eventType = mapProviderEventType("dotloop", rawEvent);
    if (!eventType) return null;

    const loop = (p.loop as Record<string, unknown> | null) ?? null;
    const providerId = loop && typeof loop.id === "string" ? loop.id : "";
    if (!providerId) return null;

    const participant = (p.participant as Record<string, unknown> | null) ?? null;
    const signerIndex =
      participant && typeof participant.index === "number"
        ? participant.index
        : null;

    const occurredAt =
      typeof p.occurredAt === "string"
        ? p.occurredAt
        : typeof p.occurred_at === "string"
          ? p.occurred_at
          : null;

    const externalEventId = typeof p.eventId === "string" ? p.eventId : null;

    const result: ParsedProviderEvent = {
      providerId,
      externalEventId,
      eventType,
      signerIndex,
      occurredAt,
    };
    return result;
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
