import { supabaseServer } from "@/lib/supabaseServer";

type LeadType = "seller" | "buyer";

function inferLeadType(input: any): LeadType {
  const raw = String(input?.lead_type ?? "").toLowerCase();
  if (raw === "buyer" || raw === "refinance") return "buyer";

  const source = String(input?.source ?? "").toLowerCase();
  if (source.includes("mortgage") || source.includes("rate")) return "buyer";

  return "seller";
}

const STEPS: Array<{ dayOffset: number; channel: "email" | "sms" }> = [
  { dayOffset: 0, channel: "email" },
  { dayOffset: 1, channel: "sms" },
  { dayOffset: 3, channel: "email" },
  { dayOffset: 5, channel: "sms" },
  { dayOffset: 7, channel: "email" },
];

const STEPS_SKIP_DAY0: Array<{ dayOffset: number; channel: "email" | "sms" }> = [
  { dayOffset: 1, channel: "sms" },
  { dayOffset: 3, channel: "email" },
  { dayOffset: 5, channel: "sms" },
  { dayOffset: 7, channel: "email" },
];

async function ensureTemplates(leadType: LeadType) {
  const { data, error } = await supabaseServer
    .from("message_templates")
    .select("id,channel")
    .eq("lead_type", leadType)
    .in("channel", ["email", "sms"]);

  if (error) throw error;

  const byChannel = new Map<string, string>();
  (data ?? []).forEach((r: any) => byChannel.set(String(r.channel).toLowerCase(), String(r.id)));

  const emailTemplateId = byChannel.get("email") ?? null;
  const smsTemplateId = byChannel.get("sms") ?? null;

  if (!emailTemplateId || !smsTemplateId) {
    throw new Error(`Missing message_templates for lead_type=${leadType}`);
  }

  return { emailTemplateId, smsTemplateId };
}

async function upsertLeadSequence(leadIdNum: number, steps: typeof STEPS, leadType: LeadType, nextSendAt: Date) {
  const { data: existingSeq, error: seqErr } = await supabaseServer
    .from("lead_sequences")
    .select("id")
    .eq("lead_id", leadIdNum)
    .maybeSingle();

  if (seqErr && (seqErr as any).code !== "PGRST116") throw seqErr;

  let sequenceId: string;
  if (existingSeq?.id) {
    sequenceId = String(existingSeq.id);
    await supabaseServer
      .from("lead_sequences")
      .update({
        status: "active",
        current_step: 0,
        next_send_at: nextSendAt.toISOString(),
      })
      .eq("id", sequenceId);

    await supabaseServer.from("sequence_steps").delete().eq("sequence_id", sequenceId);
  } else {
    const { data: insSeq, error: insSeqErr } = await supabaseServer
      .from("lead_sequences")
      .insert({
        lead_id: leadIdNum,
        status: "active",
        current_step: 0,
        next_send_at: nextSendAt.toISOString(),
      })
      .select("id")
      .single();
    if (insSeqErr) throw insSeqErr;
    sequenceId = String(insSeq?.id ?? "");
    if (!sequenceId) return;
  }

  const { emailTemplateId, smsTemplateId } = await ensureTemplates(leadType);

  const stepsRows = steps.map((s) => ({
    sequence_id: sequenceId,
    day_offset: s.dayOffset,
    channel: s.channel,
    template_id: s.channel === "email" ? emailTemplateId : smsTemplateId,
    sent: false,
  }));

  const { error: stepsErr } = await supabaseServer.from("sequence_steps").insert(stepsRows as any);
  if (stepsErr) throw stepsErr;

  await supabaseServer
    .from("leads")
    .update({
      automation_disabled: true,
      next_contact_at: nextSendAt.toISOString(),
    } as any)
    .eq("id", leadIdNum);
}

export async function scheduleEmailSequenceForLead(leadId: string) {
  const leadIdNum = Number(leadId);
  if (!Number.isFinite(leadIdNum)) return;

  const now = new Date();

  const { data: lead, error: leadErr } = await supabaseServer
    .from("leads")
    .select("id,lead_type,source,stage,created_at")
    .eq("id", leadIdNum)
    .maybeSingle();
  if (leadErr) throw leadErr;
  if (!lead) return;

  const leadType = inferLeadType(lead);
  const firstStep = STEPS[0];
  const nextSendAt = new Date(now);
  nextSendAt.setDate(now.getDate() + firstStep.dayOffset);

  await upsertLeadSequence(leadIdNum, STEPS, leadType, nextSendAt);
}

// Used when we already send an email immediately (so we don't duplicate "day 0").
export async function scheduleEmailSequenceForLeadSkipDay0(leadId: string) {
  const leadIdNum = Number(leadId);
  if (!Number.isFinite(leadIdNum)) return;

  const now = new Date();

  const { data: lead, error: leadErr } = await supabaseServer
    .from("leads")
    .select("id,lead_type,source,stage,created_at")
    .eq("id", leadIdNum)
    .maybeSingle();
  if (leadErr) throw leadErr;
  if (!lead) return;

  const leadType = inferLeadType(lead);
  const firstStep = STEPS_SKIP_DAY0[0];
  const nextSendAt = new Date(now);
  nextSendAt.setDate(now.getDate() + firstStep.dayOffset);

  await upsertLeadSequence(leadIdNum, STEPS_SKIP_DAY0, leadType, nextSendAt);
}

