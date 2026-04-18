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
  let delivered = false;

  if (deliver && process.env.RESEND_API_KEY?.trim()) {
    // Let the error propagate so callers know the message was not sent.
    const result = await sendEmail({
      to: params.to.trim(),
      subject: params.subject,
      text: params.body,
    });
    externalId = result?.id ? String(result.id) : null;
    delivered = true;
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
      contact_id: params.leadId,
      type: "email",
      status: delivered ? "sent" : "queued",
      content: `${params.subject}\n\n${params.body}`,
    } as Record<string, unknown>);
  } catch {
    // optional
  }

  try {
    await supabaseAdmin.rpc("log_lead_event", {
      p_contact_id: params.leadId,
      p_event_type: "email_sent",
      p_metadata: {
        to: params.to,
        subject: params.subject,
        externalMessageId: externalId,
        actorType: params.actorType ?? "system",
        actorName: params.actorName ?? null,
        delivered,
      },
    });
  } catch {
    // optional
  }

  // Update last_contacted_at on the lead.
  try {
    await supabaseAdmin
      .from("contacts")
      .update({ last_contacted_at: new Date().toISOString() } as Record<string, unknown>)
      .eq("id", params.leadId);
  } catch {
    // optional column
  }

  return { success: true as const, delivered, externalMessageId: externalId };
}
