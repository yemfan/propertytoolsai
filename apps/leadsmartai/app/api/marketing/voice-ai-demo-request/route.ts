import { NextResponse } from "next/server";

import { sendEmail } from "@/lib/email";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

/**
 * Capture an agent-prospect demo request from the public Voice AI test-drive
 * page. The audience here is REAL-ESTATE AGENTS evaluating LeadSmart, not
 * consumer leads — so:
 *
 *   - source = "voice_ai_demo" (filterable in the CRM)
 *   - lead_type = "agent_prospect" (so the consumer-side AI nurture cron
 *     does not start texting them — they're our sales lead, not theirs)
 *   - automation_disabled = true (defense-in-depth — even if the lead_type
 *     filter fails, no automated CRM SMS goes to a sales prospect)
 *
 * Notification: sends a plain-text email to VOICE_DEMO_NOTIFY_EMAIL when
 * configured. Outbound AI demo call wiring (the "have it call me" intent)
 * is intentionally a follow-up — for now we capture intent + email the
 * sales team to do the call manually.
 *
 * No auth — public form. Basic rate-limit protection is left to upstream
 * infra (Vercel WAF / future BotID gate) so this handler stays focused on
 * persistence + notification.
 */

type Body = {
  name?: string;
  brokerage?: string | null;
  phone?: string;
  email?: string;
  intent?: "hear_it" | "agent_demo" | string;
  consent?: boolean;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatUsPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return null;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function isAcceptedIntent(v: unknown): v is "hear_it" | "agent_demo" {
  return v === "hear_it" || v === "agent_demo";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    const name = String(body.name ?? "").trim();
    const brokerage = body.brokerage ? String(body.brokerage).trim() || null : null;
    const phone = body.phone ? formatUsPhone(String(body.phone)) : null;
    const email = String(body.email ?? "").trim().toLowerCase();
    const intent = isAcceptedIntent(body.intent) ? body.intent : "agent_demo";
    const consent = body.consent === true;

    if (!name) {
      return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ ok: false, error: "phone_invalid" }, { status: 400 });
    }
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: "email_invalid" }, { status: 400 });
    }
    if (!consent) {
      return NextResponse.json({ ok: false, error: "consent_required" }, { status: 400 });
    }

    const insert = {
      agent_id: null,
      name,
      email,
      phone,
      phone_number: phone,
      source: "voice_ai_demo",
      stage: "voice_demo_requested",
      lead_status: "new",
      lead_type: "agent_prospect",
      intent,
      rating: "warm",
      contact_method: "email",
      sms_opt_in: true,
      tcpa_consent_at: new Date().toISOString(),
      tcpa_consent_source: "web_form",
      automation_disabled: true, // sales prospect — keep consumer AI nurture off
      notes: JSON.stringify({
        voice_ai_demo: { intent, brokerage },
      }),
    } as Record<string, unknown>;

    const { data: inserted, error: insertErr } = await supabaseServer
      .from("contacts")
      .insert(insert)
      .select("id")
      .single();

    if (insertErr || !inserted?.id) {
      return NextResponse.json(
        { ok: false, error: insertErr?.message ?? "save_failed" },
        { status: 500 },
      );
    }

    const leadId = String(inserted.id);

    // Notify the sales/founder address (best-effort; never block the response).
    const notifyTo = process.env.VOICE_DEMO_NOTIFY_EMAIL?.trim();
    if (notifyTo) {
      try {
        await sendEmail({
          to: notifyTo,
          subject: `[Voice AI demo] ${intent} — ${name}${brokerage ? ` (${brokerage})` : ""}`,
          text: [
            `New voice AI demo request.`,
            ``,
            `Intent: ${intent === "hear_it" ? "Have the AI call them" : "Book a private agent demo"}`,
            `Name: ${name}`,
            `Brokerage: ${brokerage ?? "—"}`,
            `Phone: ${phone}`,
            `Email: ${email}`,
            ``,
            `Lead id: ${leadId}`,
            `Source: voice_ai_demo`,
            ``,
            `Action: ${
              intent === "hear_it"
                ? "Trigger an outbound demo call to the phone above (Twilio voice + OpenAI Realtime)."
                : "Reach out within one business day to schedule a private demo."
            }`,
          ].join("\n"),
        });
      } catch (e) {
        console.warn("[voice-ai-demo-request] notify email failed", e);
      }
    }

    return NextResponse.json({ ok: true, leadId, intent });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("voice-ai-demo-request", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
