import { supabaseServer } from "@/lib/supabaseServer";
import { generateReply, type ReplyMessage } from "@/lib/aiReplyGenerator";
import { sendSMS } from "@/lib/twilioSms";
import { sendEmail } from "@/lib/email";
import { appendMessages, getOrCreateConversation, type StoredMessage } from "@/lib/leadConversationHelpers";

export type FollowupKind = "1h" | "24h" | "3d";

const DELAYS: Record<FollowupKind, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
};

function toE164(phone: string): string | null {
  const d = phone.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `+1${d}` : null;
}

/**
 * Schedule 1h / 24h / 3d follow-up jobs (replaces pending jobs for same lead).
 */
export async function scheduleFollowUpsForLead(leadId: string, agentId: string) {
  await supabaseServer
    .from("ai_followup_jobs")
    .update({ status: "cancelled" } as any)
    .eq("contact_id", leadId)
    .eq("status", "scheduled");

  const now = Date.now();
  const rows = (Object.keys(DELAYS) as FollowupKind[]).map((kind) => ({
    contact_id: leadId as any,
    agent_id: agentId,
    kind,
    run_at: new Date(now + DELAYS[kind]).toISOString(),
    status: "scheduled",
  }));

  const { error } = await supabaseServer.from("ai_followup_jobs").insert(rows as any);
  if (error) throw error;
}

async function hasInboundSince(leadId: string, sinceIso: string): Promise<boolean> {
  const { data, error } = await supabaseServer
    .from("sms_messages")
    .select("id")
    .eq("contact_id", leadId)
    .eq("direction", "inbound")
    .gte("created_at", sinceIso)
    .limit(1);
  if (error) {
    console.warn("hasInboundSince", error);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

type LeadRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  property_address?: string | null;
  search_location?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  intent?: string | null;
  rating?: string | null;
  source?: string | null;
  lead_status?: string | null;
  contact_method?: string | null;
  automation_disabled?: boolean | null;
};

/**
 * Process due follow-up jobs (called from cron). Skips if lead replied (inbound SMS) after job creation.
 */
export async function processDueFollowupJobs(limit = 25): Promise<{
  processed: number;
  sent: number;
  skipped: number;
}> {
  const nowIso = new Date().toISOString();
  const { data: jobs, error } = await supabaseServer
    .from("ai_followup_jobs")
    .select("id,contact_id,agent_id,kind,created_at,status")
    .eq("status", "scheduled")
    .lte("run_at", nowIso)
    .limit(limit);

  if (error) throw error;

  let processed = 0;
  let sent = 0;
  let skipped = 0;

  for (const job of (jobs as any[]) ?? []) {
    processed++;
    const jobId = String(job.id);
    const leadId = String(job.contact_id);
    const agentId = String(job.agent_id ?? "");
    const createdAt = String(job.created_at);

    if (await hasInboundSince(leadId, createdAt)) {
      await supabaseServer.from("ai_followup_jobs").update({ status: "skipped" } as any).eq("id", jobId);
      skipped++;
      continue;
    }

    const { data: lead, error: leadErr } = await supabaseServer
      .from("contacts")
      .select(
        "id,name,email,phone,property_address,search_location,price_min,price_max,intent,rating,source,lead_status,contact_method,automation_disabled,sms_ai_enabled"
      )
      .eq("id", leadId)
      .maybeSingle();

    if (leadErr || !lead) {
      await supabaseServer
        .from("ai_followup_jobs")
        .update({ status: "failed", last_error: "lead_not_found" } as any)
        .eq("id", jobId);
      continue;
    }

    const L = lead as LeadRow & { sms_ai_enabled?: boolean };
    if (L.automation_disabled) {
      await supabaseServer.from("ai_followup_jobs").update({ status: "skipped" } as any).eq("id", jobId);
      skipped++;
      continue;
    }

    const { data: agent } = await supabaseServer
      .from("agents")
      .select("ai_assistant_enabled,ai_assistant_mode")
      .eq("id", agentId)
      .maybeSingle();
    const aiOn = (agent as any)?.ai_assistant_enabled !== false;
    if (!aiOn) {
      await supabaseServer.from("ai_followup_jobs").update({ status: "skipped" } as any).eq("id", jobId);
      skipped++;
      continue;
    }
    if ((agent as any)?.ai_assistant_mode === "manual") {
      await supabaseServer
        .from("ai_followup_jobs")
        .update({ status: "skipped", last_error: "manual_mode" } as any)
        .eq("id", jobId);
      skipped++;
      continue;
    }

    const conv = await getOrCreateConversation(leadId, agentId);
    const messages = (Array.isArray((conv as any).messages) ? (conv as any).messages : []) as ReplyMessage[];

    const text = await generateReply({
      lead: L,
      messages,
      task: `${String(job.kind)} follow-up — no reply yet`,
    });

    const method = String(L.contact_method ?? "email");
    let ok = false;

    try {
      if ((method === "sms" || method === "both") && L.phone) {
        const to = toE164(String(L.phone));
        if (to) {
          await sendSMS(to, text, leadId);
          ok = true;
        }
      }
      if (!ok && (method === "email" || method === "both") && L.email) {
        await sendEmail({
          to: String(L.email),
          subject: "Quick follow-up",
          text,
        });
        ok = true;
      }
    } catch (e: any) {
      await supabaseServer
        .from("ai_followup_jobs")
        .update({ status: "failed", last_error: e?.message ?? "send_error" } as any)
        .eq("id", jobId);
      continue;
    }

    if (ok) {
      const msg: StoredMessage = {
        role: "assistant",
        content: text,
        created_at: new Date().toISOString(),
        source: `followup_${String(job.kind)}`,
      };
      await appendMessages(leadId, agentId, [msg]);
      await supabaseServer.from("ai_followup_jobs").update({ status: "sent" } as any).eq("id", jobId);
      // Update last_contacted_at on the lead.
      try {
        await supabaseServer
          .from("contacts")
          .update({ last_contacted_at: new Date().toISOString() } as Record<string, unknown>)
          .eq("id", leadId);
      } catch { /* best-effort */ }
      sent++;
    } else {
      await supabaseServer
        .from("ai_followup_jobs")
        .update({ status: "failed", last_error: "no_channel" } as any)
        .eq("id", jobId);
    }
  }

  return { processed, sent, skipped };
}
