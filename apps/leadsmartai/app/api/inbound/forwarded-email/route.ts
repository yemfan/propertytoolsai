import { NextResponse } from "next/server";
import { findAgentByLocalPart, recordInboundDelivery } from "@/lib/inbound/aliases";
import { classifyInboundEmail, intentLabel } from "@/lib/inbound/intent";
import { createTask } from "@/lib/crm/pipeline/tasks";

export const runtime = "nodejs";
// SendGrid Inbound Parse can attach 25 MB+ payloads. Allow generous
// duration so the multipart parse + DB writes finish.
export const maxDuration = 60;

/**
 * POST /api/inbound/forwarded-email
 *
 * Accepts SendGrid Inbound Parse webhook payloads (multipart/form-data
 * with `from`, `to`, `subject`, `text`, `html`, `attachments`,
 * `attachment-info`, etc.). Looks up the recipient's local_part
 * against `agent_inbound_aliases`, classifies the email's intent
 * (offer / listing / showing / unknown), and creates a "Review
 * auto-imported …" task on the agent's task list.
 *
 * What this endpoint does NOT do (Phase 2):
 *   - Run the offer / listing extractor on PDF attachments
 *   - Auto-create draft offers / listings / showings
 *   - Match the email sender against existing CRM contacts
 *
 * Phase 1 = "the email shows up as a task". Phase 2 = "the task
 * comes pre-populated with a draft offer/listing/showing and the
 * agent only has to review + save". Splitting so we can validate
 * agents are actually forwarding emails before investing in the
 * extraction wiring.
 *
 * Auth: shared secret in the URL query (?secret=…) and/or
 * `x-inbound-secret` header. Configure SendGrid to send one of those
 * — we accept either so the SendGrid setup doesn't have to know.
 */

const MAX_BODY_BYTES = 30 * 1024 * 1024;

function authorize(req: Request): boolean {
  const expected = process.env.INBOUND_PARSE_SECRET?.trim();
  if (!expected) {
    // Fail-closed in production. Accept in dev so the endpoint is
    // testable without secret round-tripping.
    return process.env.NODE_ENV !== "production";
  }
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("secret");
  const headerToken = req.headers.get("x-inbound-secret");
  return queryToken === expected || headerToken === expected;
}

/**
 * Pull the local_part out of a "to" header that SendGrid hands us.
 * SendGrid sometimes sends multiple recipients in `to`; the one we
 * care about is whichever resolves to our inbox subdomain.
 */
function extractLocalPart(rawTo: string | null, domain: string): string | null {
  if (!rawTo) return null;
  // Split on commas, then for each address pull out the local_part.
  const candidates = rawTo.split(",").map((s) => s.trim());
  const domainSuffix = `@${domain.toLowerCase()}`;
  for (const cand of candidates) {
    // Address may be "Name <local@domain>" or "local@domain".
    const angle = cand.match(/<([^>]+)>/);
    const addr = (angle ? angle[1] : cand).trim().toLowerCase();
    if (addr.endsWith(domainSuffix)) {
      return addr.slice(0, -domainSuffix.length);
    }
  }
  return null;
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json(
        { ok: false, error: "Expected multipart/form-data from SendGrid Inbound Parse." },
        { status: 400 },
      );
    }

    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Payload too large." },
        { status: 413 },
      );
    }

    const form = await req.formData();
    const fromHeader = (form.get("from") as string | null) ?? null;
    const toHeader = (form.get("to") as string | null) ?? null;
    const subject = (form.get("subject") as string | null) ?? null;
    const text = (form.get("text") as string | null) ?? null;

    const domain = process.env.INBOUND_EMAIL_DOMAIN?.trim() || "inbox.leadsmart-ai.com";
    const localPart = extractLocalPart(toHeader, domain);
    if (!localPart) {
      // Drop random POSTs targeting addresses we don't own. SendGrid
      // shouldn't deliver these to us in the first place if the MX is
      // configured correctly, but defense-in-depth.
      return NextResponse.json({ ok: true, accepted: false, reason: "to-mismatch" });
    }

    const alias = await findAgentByLocalPart(localPart);
    if (!alias) {
      return NextResponse.json({ ok: true, accepted: false, reason: "unknown-alias" });
    }

    // Detect PDF attachments via SendGrid's `attachments` count + the
    // `attachment-info` JSON. Phase 1 just records "had attachments?"
    // for the task body; Phase 2 will run the extractor.
    const attachmentCount = Number(form.get("attachments") ?? 0);
    let hasPdfAttachment = false;
    if (attachmentCount > 0) {
      // attachment-info is JSON: { "attachment1": { "filename": "...", "type": "application/pdf", ... } }
      const infoRaw = (form.get("attachment-info") as string | null) ?? null;
      if (infoRaw) {
        try {
          const info = JSON.parse(infoRaw) as Record<string, { type?: string; filename?: string }>;
          hasPdfAttachment = Object.values(info).some(
            (a) =>
              (a.type ?? "").toLowerCase().includes("pdf") ||
              (a.filename ?? "").toLowerCase().endsWith(".pdf"),
          );
        } catch {
          // ignore parse errors — fall through with hasPdfAttachment=false
        }
      }
    }

    const intent = classifyInboundEmail({ subject, text, hasPdfAttachment });
    const intentText = intentLabel(intent);

    // Build a concise task title. Subject when present, else a generic
    // line so the task list isn't filled with "(no subject)".
    const cleanSubject = (subject ?? "").trim();
    const senderShort = (fromHeader ?? "").replace(/<[^>]+>/, "").trim() || fromHeader || "an email forward";
    const title = cleanSubject
      ? `Review forwarded ${intentText.toLowerCase()}: ${cleanSubject.slice(0, 80)}`
      : `Review forwarded ${intentText.toLowerCase()} from ${senderShort.slice(0, 60)}`;

    // Body: include the from/to/subject + first ~1500 chars of body so
    // the agent can preview without opening their inbox. Phase 2 will
    // also link the PDF attachment if any.
    const bodyParts: string[] = [];
    if (fromHeader) bodyParts.push(`From: ${fromHeader}`);
    if (toHeader) bodyParts.push(`To: ${toHeader}`);
    if (cleanSubject) bodyParts.push(`Subject: ${cleanSubject}`);
    if (hasPdfAttachment) bodyParts.push("📎 PDF attachment present (extractor will be wired in Phase 2)");
    if (text) {
      bodyParts.push("");
      bodyParts.push(text.slice(0, 1500));
      if (text.length > 1500) bodyParts.push(`…(${text.length - 1500} more chars truncated)`);
    }
    const description = bodyParts.join("\n");

    await createTask({
      agentId: alias.agent_id,
      title,
      description,
      priority: intent === "offer_received" || intent === "showing_requested" ? "high" : "normal",
      source: "automation",
    });

    await recordInboundDelivery(alias.id);

    return NextResponse.json({ ok: true, accepted: true, intent });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("POST /api/inbound/forwarded-email:", err);
    // Return 500 so SendGrid retries — its Inbound Parse will retry on
    // 4xx-not-401 / 5xx within its retry window.
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
