import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  countRecentDeliveriesForAlias,
  DEFAULT_DAILY_DELIVERY_CAP,
  findAgentByLocalPart,
  recordInboundDelivery,
} from "@/lib/inbound/aliases";
import { classifyInboundEmail, intentLabel } from "@/lib/inbound/intent";
import { createTask } from "@/lib/crm/pipeline/tasks";
import { verifySvixSignature } from "@/lib/email-tracking/svix";
import {
  createInboundDelivery,
  setInboundDeliveryTaskId,
  type InboundAttachmentMeta,
} from "@/lib/inbound/deliveries";
import {
  attemptExtraction,
  summarizeExtraction,
} from "@/lib/inbound/extractFromAttachments";
import { matchSenderToContact } from "@/lib/inbound/matchSenderContact";

export const runtime = "nodejs";
// Resend gives us signed PDF URLs we fetch on demand; Claude PDF
// extraction itself is 15-40s on dense purchase agreements. 60s
// covers fetch + extract + DB writes with comfortable headroom.
export const maxDuration = 60;

/**
 * POST /api/inbound/forwarded-email
 *
 * Resend Inbound Email webhook. JSON body, Svix-signed (same
 * pattern as our existing outbound `/api/webhooks/resend` route,
 * with a separate signing secret because Resend treats inbound and
 * outbound as separate webhooks in their dashboard).
 *
 * Phase 2 extension: we now ALSO
 *   - Persist the email envelope + attachment metadata in
 *     `inbound_email_deliveries` so the agent can review what we
 *     parsed from a dedicated page.
 *   - Run the matching PDF extractor inline when intent is
 *     `offer_received` (→ ParsedOffer) or `listing_signed` (→ RLA
 *     shape). Failure is non-fatal — the delivery is still stored
 *     with extraction_status='failed', and the review page exposes
 *     a "Retry extraction" button.
 *   - Surface the extraction summary in the task title (e.g.
 *     "Review forwarded offer: $750k @ 123 Main St") and link the
 *     task description to /dashboard/inbound/[id].
 */

type ResendInboundAttachment = {
  filename?: string;
  content_type?: string;
  content_url?: string;
};

type ResendInboundData = {
  id?: string;
  from?: string;
  to?: string[];
  cc?: string[];
  subject?: string;
  text?: string;
  html?: string;
  attachments?: ResendInboundAttachment[];
};

type ResendInboundPayload = {
  type?: string;
  created_at?: string;
  data?: ResendInboundData;
};

function pickLocalPart(toList: string[] | undefined, domain: string): string | null {
  if (!toList || toList.length === 0) return null;
  const domainSuffix = `@${domain.toLowerCase()}`;
  for (const raw of toList) {
    if (typeof raw !== "string") continue;
    // Resend sometimes hands us "Name <addr>" form; pull the addr out.
    const angle = raw.match(/<([^>]+)>/);
    const addr = (angle ? angle[1] : raw).trim().toLowerCase();
    if (addr.endsWith(domainSuffix)) {
      return addr.slice(0, -domainSuffix.length);
    }
  }
  return null;
}

/**
 * Origin of the dashboard, used to build the review-page link in the
 * task description. Falls back to the production domain so the link
 * is still reachable even if NEXT_PUBLIC_APP_URL isn't configured in
 * the inbound webhook environment.
 */
function getAppOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "https://www.leadsmart-ai.com";
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const h = await headers();
  const svixId = h.get("svix-id");
  const svixTimestamp = h.get("svix-timestamp");
  const svixSignature = h.get("svix-signature");

  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET ?? "";
  if (!secret) {
    console.error("[inbound] RESEND_INBOUND_WEBHOOK_SECRET not configured");
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 500 });
  }

  const verification = verifySvixSignature({
    secret,
    rawBody,
    svixId,
    svixTimestamp,
    svixSignature,
  });
  if (!verification.ok) {
    console.warn("[inbound] svix rejected:", verification.reason);
    return NextResponse.json(
      { ok: false, error: "invalid signature" },
      { status: 401 },
    );
  }

  let payload: ResendInboundPayload;
  try {
    payload = JSON.parse(rawBody) as ResendInboundPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  // Only process email.received events. Resend may send other event
  // types on the inbound webhook (e.g. delivery diagnostics) — those
  // should silently 200 so Resend doesn't retry.
  if (payload.type !== "email.received") {
    return NextResponse.json({ ok: true, ignored: true, reason: "non-receive-event" });
  }

  const data = payload.data ?? {};
  const domain = process.env.INBOUND_EMAIL_DOMAIN?.trim() || "inbox.leadsmart-ai.com";
  const localPart = pickLocalPart(data.to, domain);
  if (!localPart) {
    return NextResponse.json({ ok: true, accepted: false, reason: "to-mismatch" });
  }

  const alias = await findAgentByLocalPart(localPart);
  if (!alias) {
    return NextResponse.json({ ok: true, accepted: false, reason: "unknown-alias" });
  }

  // ── Per-alias daily rate limit ───────────────────────────────────
  // Friendly slugs (fan.yes@…) are guessable from a public customer
  // roster, so we cap deliveries-per-alias-per-rolling-24h to bound
  // abuse damage. Limit hits return 200 so Resend doesn't retry.
  const recentCount = await countRecentDeliveriesForAlias(alias.id);
  if (recentCount >= DEFAULT_DAILY_DELIVERY_CAP) {
    console.warn(
      `[inbound] rate-limited alias=${alias.local_part} count=${recentCount} cap=${DEFAULT_DAILY_DELIVERY_CAP}`,
    );
    return NextResponse.json({
      ok: true,
      accepted: false,
      reason: "rate-limited",
      cap: DEFAULT_DAILY_DELIVERY_CAP,
    });
  }

  const subject = (data.subject ?? "").trim() || null;
  const text = data.text ?? null;
  const fromHeader = data.from ?? null;
  const toLine = (data.to ?? []).join(", ") || null;

  const rawAttachments = Array.isArray(data.attachments) ? data.attachments : [];
  const attachments: InboundAttachmentMeta[] = rawAttachments.map((a) => ({
    filename: a.filename ?? null,
    content_type: a.content_type ?? null,
    content_url: a.content_url ?? null,
  }));
  const pdfAttachments = attachments.filter(
    (a) =>
      (a.content_type ?? "").toLowerCase().includes("pdf") ||
      (a.filename ?? "").toLowerCase().endsWith(".pdf"),
  );
  const hasPdfAttachment = pdfAttachments.length > 0;

  const intent = classifyInboundEmail({ subject, text, hasPdfAttachment });
  const intentText = intentLabel(intent);

  // ── Run extraction inline (best-effort) ─────────────────────────
  // Failures here don't block delivery + task creation; we just store
  // extraction_status='failed' and the review page surfaces a retry.
  const extractionResult = await attemptExtraction({ intent, attachments });

  // ── Suggested-contact match (Phase 2B-1) ────────────────────────
  // Best-effort: parse the `from` header and look up the agent's
  // contacts by email. The review page will surface the match as a
  // suggestion the agent can confirm or override — never auto-route
  // (forwarded offers commonly arrive `From:` a TC or assistant, so
  // a wrong guess would mis-attribute the deal).
  const contactMatch = await matchSenderToContact(alias.agent_id, fromHeader);

  // ── Persist the delivery row ────────────────────────────────────
  const textPreview = text ? text.slice(0, 2000) : null;
  let delivery;
  try {
    delivery = await createInboundDelivery({
      aliasId: alias.id,
      agentId: alias.agent_id,
      resendMessageId: data.id ?? null,
      intent,
      fromHeader,
      toHeader: toLine,
      subject,
      textPreview,
      attachments,
      extractionStatus: extractionResult.status,
      extraction:
        extractionResult.status === "extracted" ? extractionResult.payload : null,
      extractionError:
        extractionResult.status === "failed" ? extractionResult.error : null,
      matchedContactId: contactMatch?.id ?? null,
    });
  } catch (e) {
    console.error("[inbound] delivery insert failed:", e);
    // 500 → Resend retries. The delivery row is the canonical record;
    // we'd rather retry than lose the email entirely.
    return NextResponse.json(
      { ok: false, error: "delivery insert failed" },
      { status: 500 },
    );
  }

  // ── Build the task title + body ─────────────────────────────────
  const senderShort = fromHeader
    ? fromHeader.replace(/<[^>]+>/, "").trim() || fromHeader
    : "an email forward";

  // Prefer the extraction summary (price + address) over the raw
  // subject — gives the agent a useful triage signal at the task list.
  const extractionSummary =
    extractionResult.status === "extracted"
      ? summarizeExtraction(extractionResult.payload)
      : null;

  const titleSuffix =
    extractionSummary ?? subject?.slice(0, 80) ?? `from ${senderShort.slice(0, 60)}`;
  const title = `Review forwarded ${intentText.toLowerCase()}: ${titleSuffix}`;

  const reviewUrl = `${getAppOrigin()}/dashboard/inbound/${delivery.id}`;

  const bodyParts: string[] = [];
  bodyParts.push(`📥 Open the review page: ${reviewUrl}`);
  bodyParts.push("");
  if (fromHeader) bodyParts.push(`From: ${fromHeader}`);
  if (toLine) bodyParts.push(`To: ${toLine}`);
  if (subject) bodyParts.push(`Subject: ${subject}`);
  if (pdfAttachments.length > 0) {
    bodyParts.push(
      `📎 ${pdfAttachments.length} PDF attachment${pdfAttachments.length === 1 ? "" : "s"}: ${pdfAttachments
        .map((a) => a.filename ?? "(unnamed)")
        .join(", ")}`,
    );
  }
  if (extractionResult.status === "extracted") {
    bodyParts.push(`✅ AI extracted ${extractionResult.payload.kind} fields — review on the page above.`);
  } else if (extractionResult.status === "failed") {
    bodyParts.push(`⚠️ AI extraction failed: ${extractionResult.error.slice(0, 200)} (retry on review page)`);
  } else if (extractionResult.status === "skipped" && hasPdfAttachment) {
    bodyParts.push(
      `ℹ️ No extractor for intent "${intentText}" — open the review page to act on it manually.`,
    );
  }
  if (text) {
    bodyParts.push("");
    bodyParts.push(text.slice(0, 1500));
    if (text.length > 1500) bodyParts.push(`…(${text.length - 1500} more chars truncated)`);
  }
  const description = bodyParts.join("\n");

  // ── Create the task + back-link to the delivery row ─────────────
  try {
    const task = await createTask({
      agentId: alias.agent_id,
      title,
      description,
      priority:
        intent === "offer_received" || intent === "showing_requested"
          ? "high"
          : "normal",
      source: "automation",
    });
    await setInboundDeliveryTaskId(delivery.id, task.id);
    await recordInboundDelivery(alias.id);
    return NextResponse.json({
      ok: true,
      accepted: true,
      intent,
      deliveryId: delivery.id,
      taskId: task.id,
      extractionStatus: extractionResult.status,
    });
  } catch (e) {
    console.error("[inbound] task create failed:", e);
    // Delivery row already exists; 500 so Resend retries the whole
    // event. If retry succeeds, the duplicate delivery row is harmless
    // (review page lists are dated; agent sees the most recent).
    return NextResponse.json(
      { ok: false, error: "task create failed" },
      { status: 500 },
    );
  }
}
