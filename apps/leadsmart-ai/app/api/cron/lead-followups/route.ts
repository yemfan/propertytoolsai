import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { sendEmail } from "@/lib/email";
import { generateFollowUpMessage } from "@/lib/followupAI";

function addNext(now: Date, freq: string) {
  const d = new Date(now.toISOString());
  if (freq === "daily") d.setUTCDate(d.getUTCDate() + 1);
  else if (freq === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString();
}

export async function GET() {
  try {
    const now = new Date();
    const nowIso = now.toISOString();

    const { data: leads, error } = await supabaseServer
      .from("leads")
      .select(
        "id,agent_id,name,email,phone,property_address,rating,contact_frequency,contact_method,next_contact_at,automation_disabled"
      )
      .lte("next_contact_at", nowIso)
      .limit(100);

    if (error) throw error;

    let processed = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const lead of (leads as any[]) ?? []) {
      processed++;
      const leadId = String(lead.id);
      const agentId = lead.agent_id ? String(lead.agent_id) : null;
      if (lead.automation_disabled) {
        skipped++;
        continue;
      }
      const method = String(lead.contact_method ?? "email");
      const freq = String(lead.contact_frequency ?? "weekly");
      const rating = (String(lead.rating ?? "warm") as any) as "hot" | "warm" | "cold";
      const name = String(lead.name ?? "there");
      const address = String(lead.property_address ?? "");

      const content = await generateFollowUpMessage({
        rating,
        name,
        address,
        intent: "unknown",
      });

      // Email
      if ((method === "email" || method === "both") && lead.email) {
        try {
          await sendEmail({
            to: String(lead.email),
            subject: "Quick follow-up",
            text: content,
          });

          await supabaseServer.from("communications").insert({
            lead_id: leadId,
            agent_id: agentId,
            type: "email",
            content,
            status: "sent",
          } as any);

          sent++;
        } catch (e: any) {
          failed++;
          await supabaseServer.from("communications").insert({
            lead_id: leadId,
            agent_id: agentId,
            type: "email",
            content,
            status: "failed",
          } as any);
        }
      }

      // SMS (stub)
      if (method === "sms" || method === "both") {
        // TODO: integrate Twilio (or similar). For now log as failed to avoid silent spam.
        await supabaseServer.from("communications").insert({
          lead_id: leadId,
          agent_id: agentId,
          type: "sms",
          content,
          status: "failed",
        } as any);
      }

      const nextAt = addNext(now, freq);
      await supabaseServer
        .from("leads")
        .update({
          last_contacted_at: nowIso,
          next_contact_at: nextAt,
        })
        .eq("id", leadId);
    }

    return NextResponse.json({ ok: true, processed, sent, failed });
  } catch (e: any) {
    console.error("lead-followups cron error", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

