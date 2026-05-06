import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { findAgentByLocalPart, recordInboundDelivery } from "@/lib/inbound/aliases";
import { classifyInboundEmail, intentLabel } from "@/lib/inbound/intent";
import { createTask } from "@/lib/crm/pipeline/tasks";
import { verifySvixSignature } from "@/lib/email-tracking/svix";

export const runtime = "nodejs";
// Resend can forward emails with PDF attachments (links to fetch),
// so the call itself is fast — but allow some headroom in case
// downstream DB writes batch up.
export const maxDuration = 60;

/**
 * POST /api/inbound/forwarded-email
 *
 * Resend Inbound Email webhook. JSON body, Svix-signed (same
 * pattern as our existing outbound `/api/webhooks/resend` route,
 * with a separate signing secret because Resend treats inbound and
 * outbound as separate webhooks in their dashboard).
 *
 * Payload shape (Resend Inbound):
 *   {
 *     "type": "email.received",
 *     "created_at": "...",
 *     "data": {
 *       "id": "...",
 *       "from": "Name <sender@example.com>",
 *       "to": ["agent-abc@inbox.leadsmart-ai.com"],
 *       "subject": "...",
 *       "text": "...",
 *       "html": "...",
 *       "attachments": [{ "filename": "...", "content_type": "...", "content_url": "..." }]
 *     }
 *   }
 *
 * What this endpoint does:
 *   - Verifies the Svix signature against RESEND_INBOUND_WEBHOOK_SECRET
 *   - Pulls the local_part from any `to` address that matches our
 *     INBOUND_EMAIL_DOMAIN
 *   - Looks up the alias → agent
 *   - Classifies intent (offer / listing / showing / unknown)
 *   - Creates a high-priority "Review forwarded …" task on the
 *     agent's task list with the email's preview
 *
 * What this endpoint does NOT do (Phase 2):
 *   - Download / store attachments (Resend gives us a signed URL;
 *     the extractor would fetch on demand later)
 *   - Run AI extraction → draft creation
 *   - Match `from` address against existing CRM contacts
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

  const subject = (data.subject ?? "").trim() || null;
  const text = data.text ?? null;
  const fromHeader = data.from ?? null;

  const attachments = Array.isArray(data.attachments) ? data.attachments : [];
  const pdfAttachments = attachments.filter(
    (a) =>
      (a.content_type ?? "").toLowerCase().includes("pdf") ||
      (a.filename ?? "").toLowerCase().endsWith(".pdf"),
  );
  const hasPdfAttachment = pdfAttachments.length > 0;

  const intent = classifyInboundEmail({ subject, text, hasPdfAttachment });
  const intentText = intentLabel(intent);

  const senderShort = fromHeader
    ? fromHeader.replace(/<[^>]+>/, "").trim() || fromHeader
    : "an email forward";
  const title = subject
    ? `Review forwarded ${intentText.toLowerCase()}: ${subject.slice(0, 80)}`
    : `Review forwarded ${intentText.toLowerCase()} from ${senderShort.slice(0, 60)}`;

  // Build description: from/to/subject + attachment list + body preview.
  // Phase 2 will swap the "PDF attachment present" bullet for a link
  // back to the extractor result.
  const bodyParts: string[] = [];
  if (fromHeader) bodyParts.push(`From: ${fromHeader}`);
  const toLine = (data.to ?? []).join(", ");
  if (toLine) bodyParts.push(`To: ${toLine}`);
  if (subject) bodyParts.push(`Subject: ${subject}`);
  if (pdfAttachments.length > 0) {
    bodyParts.push(
      `📎 ${pdfAttachments.length} PDF attachment${pdfAttachments.length === 1 ? "" : "s"}: ${pdfAttachments
        .map((a) => a.filename ?? "(unnamed)")
        .join(", ")}`,
    );
    bodyParts.push("(Phase 2 will auto-extract these into a draft.)");
  }
  if (text) {
    bodyParts.push("");
    bodyParts.push(text.slice(0, 1500));
    if (text.length > 1500) bodyParts.push(`…(${text.length - 1500} more chars truncated)`);
  }
  const description = bodyParts.join("\n");

  try {
    await createTask({
      agentId: alias.agent_id,
      title,
      description,
      priority:
        intent === "offer_received" || intent === "showing_requested"
          ? "high"
          : "normal",
      source: "automation",
    });
    await recordInboundDelivery(alias.id);
    return NextResponse.json({ ok: true, accepted: true, intent });
  } catch (e) {
    console.error("[inbound] task create failed:", e);
    // 500 → Resend will retry. The task creation is the only side
    // effect that matters; better to retry than drop the email.
    return NextResponse.json(
      { ok: false, error: "task create failed" },
      { status: 500 },
    );
  }
}
