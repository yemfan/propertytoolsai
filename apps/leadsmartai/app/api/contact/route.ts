import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

import {
  CONSENT_SOURCE_CONTACT_FORM,
  CONTACT_FORM_DISCLOSURE_VERSION,
} from "@/lib/consent/disclosureVersions";
import { extractRequestMeta } from "@/lib/consent/extractRequestMeta";
import { recordInboundContactRequest } from "@/lib/consent/service";

export const runtime = "nodejs";

/**
 * Public contact-form intake.
 *
 * Doubles as the proof-of-consent endpoint for Twilio toll-free
 * verification — the form at /contact is the user-visible surface.
 *
 * Order of work:
 *   1. Validate the submission (name + email required; smsConsent w/o
 *      phone is malformed).
 *   2. Persist a row in `inbound_contact_requests` (audit table from
 *      migration 20260510000000) with the IP, UA, and pinned disclosure
 *      version. Best-effort — a DB outage MUST NOT block the email send.
 *   3. Forward the submission via SMTP so a human sees it.
 *
 * The audit row is the load-bearing piece for TCPA defense — if a
 * carrier or regulator ever asks "show me proof this number consented
 * on date X", the row + the consent_disclosure_version is the answer.
 */
export async function POST(req: Request) {
  try {
    const {
      name,
      email,
      phone,
      subject,
      message,
      smsConsent,
    } = (await req.json()) as {
      name?: string;
      email?: string;
      phone?: string;
      subject?: string;
      message?: string;
      smsConsent?: boolean;
    };

    if (!name || !email) {
      return NextResponse.json(
        { ok: false, error: "Missing name or email" },
        { status: 400 }
      );
    }

    // SMS consent without a phone number is a malformed submission —
    // surface clearly rather than silently dropping the consent flag.
    const cleanPhone = (phone ?? "").trim();
    const consent = Boolean(smsConsent);
    if (consent && !cleanPhone) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please provide a phone number to receive SMS, or untick SMS consent.",
        },
        { status: 400 }
      );
    }

    // Audit-row write FIRST so the consent record exists even if the
    // email send fails downstream. Best-effort — recordInbound...
    // catches its own errors and returns null on failure.
    const meta = extractRequestMeta(req);
    await recordInboundContactRequest({
      source: CONSENT_SOURCE_CONTACT_FORM,
      name: name ?? null,
      email: email ?? null,
      phone: cleanPhone || null,
      subject: subject?.trim() || null,
      message: message?.trim() || null,
      smsConsent: consent,
      emailConsent: null, // /contact has no separate email-consent toggle
      consentDisclosureVersion: CONTACT_FORM_DISCLOSURE_VERSION,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      contactId: null,
    });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"LeadSmart AI Contact" <fan.yes@gmail.com>`,
      to: "fan.yes@gmail.com",
      subject: subject ? `[LeadSmart Contact] ${subject}` : "New LeadSmart AI contact",
      text: `Name: ${name}
Email: ${email}
Phone: ${cleanPhone || "(not provided)"}
SMS consent: ${consent ? "YES — opted in to receive text messages" : "no"}
SMS consent timestamp: ${consent ? new Date().toISOString() : "n/a"}
Disclosure version: ${CONTACT_FORM_DISCLOSURE_VERSION}
IP: ${meta.ipAddress ?? "(unknown)"}
User-agent: ${meta.userAgent ?? "(unknown)"}

Message:
${message || "(no message provided)"}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error sending contact email", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
