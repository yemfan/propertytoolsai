import { supabaseAdmin } from "@/lib/supabase/admin";

type FollowupChannel = "email" | "sms";

type SequenceStep = {
  stepNumber: number;
  delayHours: number;
  channel: FollowupChannel;
  templateKey: string;
  subject?: string;
  message: string;
};

type BuildSequenceInput = {
  leadId: string;
  assignedAgentId?: string | null;
  assignedAgentName?: string | null;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string | null;
  propertyAddress: string;
  estimateValue: number;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function buildHomeValueSequence(input: BuildSequenceInput): SequenceStep[] {
  const firstName = input.customerName?.trim() || "there";
  const agentLine = input.assignedAgentName
    ? `I'm ${input.assignedAgentName}, and I'd be happy to help you review the next steps.`
    : "I'd be happy to help you review the next steps.";

  return [
    {
      stepNumber: 1,
      delayHours: 0,
      channel: "email",
      templateKey: "home_value_report_delivery",
      subject: `Your home value report for ${input.propertyAddress}`,
      message: `Hi ${firstName},

Thanks for unlocking your home value report for ${input.propertyAddress}.

Your current estimate is around ${money(input.estimateValue)}.

${agentLine}

You can reply to this email if you'd like help understanding:
- how this compares with recent nearby sales
- what could increase value
- what a realistic pricing strategy might look like`,
    },
    {
      stepNumber: 2,
      delayHours: 24,
      channel: "email",
      templateKey: "home_value_day_1_followup",
      subject: "Questions about your home value report?",
      message: `Hi ${firstName},

Just checking in after your home value report for ${input.propertyAddress}.

A lot of homeowners want to know whether the estimate matches what they could realistically list for in today's market.

If you'd like, I can help break that down for you.`,
    },
    {
      stepNumber: 3,
      delayHours: 72,
      channel: "email",
      templateKey: "home_value_day_3_followup",
      subject: `A quick next step for ${input.propertyAddress}`,
      message: `Hi ${firstName},

One useful next step after a home value estimate is comparing your property against a few recent nearby sales.

That usually gives a clearer picture of:
- pricing range
- buyer demand
- likely listing position

Reply if you'd like help with that.`,
    },
    {
      stepNumber: 4,
      delayHours: 168,
      channel: "email",
      templateKey: "home_value_day_7_followup",
      subject: "Would you like a more detailed pricing review?",
      message: `Hi ${firstName},

If you're still thinking about the value of ${input.propertyAddress}, I can help with a more detailed pricing review and discuss possible next steps.

No pressure - just reply if you'd like to continue.`,
    },
  ];
}

export async function queueHomeValueSequence(input: BuildSequenceInput) {
  const now = new Date();
  const sequenceKey = `home_value_${input.leadId}`;
  const steps = buildHomeValueSequence(input);

  const rows = steps.map((step) => ({
    lead_id: input.leadId,
    assigned_agent_id: input.assignedAgentId ?? null,
    channel: step.channel,
    subject: step.subject ?? null,
    message: step.message,
    status: "pending",
    step_number: step.stepNumber,
    scheduled_for: addHours(now, step.delayHours),
    sequence_key: sequenceKey,
    template_key: step.templateKey,
    recipient_name: input.customerName,
    recipient_email: input.customerEmail ?? null,
    recipient_phone: input.customerPhone ?? null,
    metadata: {
      source: "home_value_estimate",
      property_address: input.propertyAddress,
    },
  }));

  const { data, error } = await supabaseAdmin
    .from("lead_followups")
    .insert(rows)
    .select();

  if (error) throw error;
  return data;
}

export async function queueInitialFollowup(input: BuildSequenceInput) {
  return queueHomeValueSequence(input);
}

export async function cancelPendingFollowupsForLead(leadId: string) {
  const { error } = await supabaseAdmin
    .from("lead_followups")
    .update({ status: "cancelled" })
    .eq("lead_id", leadId)
    .eq("status", "pending");

  if (error) throw error;
}

export async function pausePendingSequenceForLead(leadId: string) {
  const { error: followupError } = await supabaseAdmin
    .from("lead_followups")
    .update({
      status: "cancelled",
    })
    .eq("lead_id", leadId)
    .eq("status", "pending");

  if (followupError) throw followupError;

  const { error: leadError } = await supabaseAdmin
    .from("leads")
    .update({
      conversation_status: "engaged",
      last_reply_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (leadError) throw leadError;

  return { success: true };
}
