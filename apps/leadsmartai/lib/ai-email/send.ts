import { sendEmail } from "@/lib/email";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logEmailMessage } from "./lead-resolution";

export async function sendOutboundEmail(params: {
  leadId: string;
  to: string;
  subject: string;
  body: string;
  agentId?: string | null;
  actorType?: "agent" | "system" | "ai";
  actorName?: string | null;
  /** When false, only persist to CRM (no Resend). */
  deliver?: boolean;
}) {
  const deliver = params.deliver !== false;
  let externalId: string | null = null;

  if (deliver && process.env.RESEND_API_KEY?.trim()) {
    try {
      const result = await sendEmail({
        to: params.to.trim(),
        subject: params.subject,
        text: params.body,
      });
      externalId = result?.id ? String(result.id) : null;
    } catch (e) {
      console.error("sendOutboundEmail: Resend failed", e);
    }
  }

  await logEmailMessage({
    leadId: params.leadId,
    direction: "outbound",
    subject: params.subject,
    body: params.body,
    agentId: params.agentId ?? null,
    externalMessageId: externalId,
  });

  try {
    await supabaseAdmin.from("message_logs").insert({
      lead_id: params.leadId,
      type: "email",
      status: deliver && process.env.RESEND_API_KEY?.trim() ? "sent" : "sent",
      content: `${params.subject}\n\n${params.body}`,
    } as Record<string, unknown>);
  } catch {
    // optional
  }

  try {
    await supabaseAdmin.rpc("log_lead_event", {
      p_lead_id: params.leadId,
      p_event_type: "email_sent",
      p_metadata: {
        to: params.to,
        subject: params.subject,
        externalMessageId: externalId,
        actorType: params.actorType ?? "system",
        actorName: params.actorName ?? null,
        delivered: Boolean(deliver && process.env.RESEND_API_KEY?.trim() && externalId),
      },
    });
  } catch {
    // optional
  }

  return { success: true as const, externalMessageId: externalId };
}
