import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

function digitsOnly(input: string) {
  return input.replace(/\D/g, "");
}

function formatUsPhoneFromDigits10(d: string) {
  const digits = d.replace(/\D/g, "").slice(0, 10);
  if (digits.length !== 10) return null;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export const runtime = "nodejs";

// Twilio webhook for inbound SMS replies.
// Configure this in Twilio Console:
// - Messaging -> Configure Webhook -> "A message comes in"
// - Endpoint: POST /api/webhooks/twilio-sms
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const from = String(formData.get("From") ?? "");
    const body = String(formData.get("Body") ?? "");

    // Identify the lead by normalizing From to the same format we store in leads.phone.
    const fromDigits = digitsOnly(from);
    const last10 = fromDigits.slice(-10);
    const formattedFrom = formatUsPhoneFromDigits10(last10);

    if (!formattedFrom) {
      return new NextResponse("<Response></Response>", {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    const { data: leadRow } = await supabaseServer
      .from("contacts")
      .select("id,agent_id")
      .eq("phone", formattedFrom)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!leadRow) {
      return new NextResponse("<Response></Response>", {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    const leadId = String(leadRow.id);
    const agentId = leadRow.agent_id ? String(leadRow.agent_id) : null;

    // Avoid duplicate reply scoring/alerts within 24h.
    const { data: existingReplied } = await supabaseServer
      .from("message_logs")
      .select("id")
      .eq("contact_id", leadId)
      .eq("status", "replied")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1)
      .maybeSingle();

    if (!existingReplied?.id) {
      // Record reply event + mark latest sms log as replied (best-effort).
      await supabaseServer.rpc("log_lead_event", {
        p_contact_id: leadId,
        p_event_type: "reply",
        p_metadata: { body },
      });

      const { data: latestSmsLog } = await supabaseServer
        .from("message_logs")
        .select("id")
        .eq("contact_id", leadId)
        .eq("type", "sms")
        .eq("status", "sent")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestSmsLog?.id) {
        await supabaseServer.from("message_logs").update({ status: "replied" }).eq("id", latestSmsLog.id);
      } else {
        await supabaseServer.from("message_logs").insert({
          contact_id: leadId,
          type: "sms",
          status: "replied",
        } as any);
      }

      const scoreRes = await supabaseServer.rpc("marketplace_apply_nurture_score", {
        p_contact_id: leadId,
        p_delta: 10,
      } as any);

      const rating = (scoreRes as any)?.data?.rating as string | undefined;

      // Stop automation for this lead.
      await supabaseServer.from("lead_sequences").update({ status: "completed" }).eq("contact_id", leadId);
      await supabaseServer.from("contacts").update({ automation_disabled: true } as any).eq("id", leadId);

      // Alerts
      if (agentId) {
        await supabaseServer.from("nurture_alerts").insert({
          agent_id: agentId,
          contact_id: leadId,
          type: "replied",
          message: "Lead replied via SMS — nurture sequence stopped.",
        } as any);

        if (rating === "hot") {
          await supabaseServer.from("nurture_alerts").insert({
            agent_id: agentId,
            contact_id: leadId,
            type: "hot",
            message: "Lead temperature turned HOT (reply).",
          } as any);
        }
      }
    }

    // Twilio expects TwiML; return empty <Response>.
    return new NextResponse("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch {
    // Always acknowledge to avoid Twilio retries.
    return new NextResponse("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
}

