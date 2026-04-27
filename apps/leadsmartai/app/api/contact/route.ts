import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

/**
 * Public contact-form intake.
 *
 * Doubles as the proof-of-consent endpoint for Twilio toll-free
 * verification — the form at /contact is the user-visible surface.
 * When `smsConsent` is true the request body captures the user's
 * affirmative SMS opt-in alongside the phone number; this endpoint
 * forwards everything via email so the submission is auditable
 * without yet introducing a dedicated DB table.
 *
 * NOTE before going to real production traffic: TCPA expects a
 * persisted consent record (timestamp + IP + the exact disclosure
 * text shown). The follow-up to this PR should add an
 * `inbound_contact_requests` table and write the audit trail there.
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

Message:
${message || "(no message provided)"}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error sending contact email", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
