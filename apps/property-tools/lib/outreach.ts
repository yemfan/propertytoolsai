import { supabaseServer } from "@/lib/supabaseServer";
import { sendEmail } from "@/lib/email";
import { sendSMS as twilioSend } from "@/lib/twilioSms";

export type OutreachUser = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  /** CRM lead id when known */
  leadId?: string | null;
};

export type OutreachLead = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  property_address?: string | null;
  agent_id?: string | null;
};

function digits10(input: string) {
  const d = input.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? d : null;
}

/** E.164 US for Twilio */
export function toE164US(phone: string): string | null {
  const d = digits10(phone);
  return d ? `+1${d}` : null;
}

export type SendSmsResult = { ok: boolean; sid?: string; error?: string };
export type SendEmailResult = { ok: boolean; error?: string };

/**
 * Send outbound SMS via Twilio (requires env). Does not throw.
 */
export async function sendSMS(user: OutreachUser, message: string): Promise<SendSmsResult> {
  const to = user.phone ? toE164US(user.phone) : null;
  if (!to) {
    return { ok: false, error: "no_valid_phone" };
  }
  try {
    const { sid } = await twilioSend(to, message, user.leadId ?? undefined);
    return { ok: true, sid };
  } catch (e: any) {
    console.error("outreach.sendSMS", e);
    return { ok: false, error: e?.message ?? "twilio_error" };
  }
}

/**
 * Send email via Resend (requires RESEND_API_KEY). Does not throw.
 */
export async function sendEmailToUser(
  user: OutreachUser,
  subject: string,
  text: string
): Promise<SendEmailResult> {
  const to = user.email?.trim();
  if (!to) {
    return { ok: false, error: "no_email" };
  }
  try {
    await sendEmail({ to, subject, text });
    return { ok: true };
  } catch (e: any) {
    console.error("outreach.sendEmailToUser", e);
    return { ok: false, error: e?.message ?? "email_error" };
  }
}

/**
 * Notify operations / listing agent inbox about a hot lead (best-effort).
 */
export async function notifyAgent(lead: OutreachLead, note?: string): Promise<void> {
  const agentEmail = process.env.AGENT_NOTIFICATION_EMAIL;
  const text = `Lead conversion alert

Lead ID: ${lead.id}
Name: ${lead.name ?? "—"}
Email: ${lead.email ?? "—"}
Phone: ${lead.phone ?? "—"}
Property: ${lead.property_address ?? "—"}
Agent ID: ${lead.agent_id ?? "—"}

${note ?? ""}

Time: ${new Date().toISOString()}`;

  if (agentEmail) {
    try {
      await sendEmail({
        to: agentEmail,
        subject: "High-intent lead — auto outreach",
        text,
      });
    } catch (e) {
      console.warn("notifyAgent: AGENT_NOTIFICATION_EMAIL failed", e);
    }
  }

  if (lead.agent_id) {
    try {
      const { data: row } = await supabaseServer
        .from("agents")
        .select("auth_user_id")
        .eq("id", lead.agent_id)
        .maybeSingle();
      const authUserId = String((row as any)?.auth_user_id ?? "");
      if (authUserId) {
        const { data: authUser } = await supabaseServer.auth.admin.getUserById(authUserId);
        const to = authUser?.user?.email;
        if (to) {
          await sendEmail({
            to,
            subject: "High-intent lead assigned to you",
            text,
          });
        }
      }
    } catch (e) {
      console.warn("notifyAgent: agent email", e);
    }
  }
}

async function recordProductEvent(
  userId: string | null,
  eventType: string,
  metadata: Record<string, unknown>
) {
  try {
    await supabaseServer.from("events").insert({
      user_id: userId,
      event_type: eventType,
      metadata,
    } as any);
  } catch (e) {
    console.warn("recordProductEvent", eventType, e);
  }
}

/**
 * Track funnel metrics for dashboards (optional aggregates).
 * `response_rate` / `conversion_rate` are typically computed offline; we store raw signals.
 */
export async function trackOutreachMetric(params: {
  userId: string | null;
  metric: "response_rate" | "conversion_rate" | "outreach_sent";
  value?: number;
  metadata?: Record<string, unknown>;
}) {
  await recordProductEvent(params.userId, "outreach_metric", {
    metric: params.metric,
    value: params.value ?? null,
    ...params.metadata,
  });
}

export async function recordOutreachSent(params: {
  userId: string | null;
  channels: ("sms" | "email")[];
  leadId?: string | null;
  score?: number;
  trigger?: string;
}) {
  await recordProductEvent(params.userId, "outreach_sent", {
    channels: params.channels,
    lead_id: params.leadId ?? null,
    score: params.score ?? null,
    trigger: params.trigger ?? "high_intent",
  });
}
