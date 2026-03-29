import { supabaseAdmin } from "@/lib/supabase/admin";
import { logLeadActivity } from "@/lib/activity/logLeadActivity";

export type ListingSequenceInput = {
  leadId: string;
  assignedAgentId?: string | null;
  assignedAgentName?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  listingId: string;
  listingAddress: string;
  actionType: "ask_agent" | "contact_agent" | "schedule_tour";
  requestedTime?: string | null;
};

type ListingFollowupStep = {
  stepNumber: number;
  delayHours: number;
  channel: "email" | "sms";
  templateKey: string;
  subject?: string;
  message: string;
};

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function buildListingSequence(input: ListingSequenceInput): ListingFollowupStep[] {
  const firstName = input.customerName?.trim() || "there";
  const agentIntro = input.assignedAgentName
    ? `${input.assignedAgentName} has been assigned to help with next steps.`
    : "Our team will help with next steps.";

  if (input.actionType === "schedule_tour") {
    return [
      {
        stepNumber: 1,
        delayHours: 0,
        channel: "email",
        templateKey: "listing_tour_request_confirmation",
        subject: `Tour request received for ${input.listingAddress}`,
        message: `Hi ${firstName},

Thanks for requesting a tour for ${input.listingAddress}.

Requested time: ${input.requestedTime || "To be confirmed"}

${agentIntro}

We'll follow up shortly to confirm availability and next steps.`,
      },
      {
        stepNumber: 2,
        delayHours: 24,
        channel: "email",
        templateKey: "listing_tour_followup_day1",
        subject: `Following up on your tour request`,
        message: `Hi ${firstName},

Just checking in regarding your tour request for ${input.listingAddress}.

If your preferred time changes, reply here and we'll update it for you.`,
      },
      {
        stepNumber: 3,
        delayHours: 72,
        channel: "email",
        templateKey: "listing_tour_followup_day3",
        subject: `Still interested in ${input.listingAddress}?`,
        message: `Hi ${firstName},

If you're still interested in ${input.listingAddress}, we can help you schedule a tour, review disclosures, and compare similar homes nearby.

Reply here if you'd like to continue.`,
      },
    ];
  }

  return [
    {
      stepNumber: 1,
      delayHours: 0,
      channel: "email",
      templateKey: "listing_inquiry_confirmation",
      subject: `Your inquiry for ${input.listingAddress}`,
      message: `Hi ${firstName},

Thanks for your interest in ${input.listingAddress}.

${agentIntro}

Reply here if you'd like property details, similar homes, or help with next steps.`,
    },
    {
      stepNumber: 2,
      delayHours: 24,
      channel: "email",
      templateKey: "listing_inquiry_followup_day1",
      subject: `Any questions about ${input.listingAddress}?`,
      message: `Hi ${firstName},

I wanted to follow up on your inquiry about ${input.listingAddress}.

If you'd like, we can help with pricing, similar homes, or setting up a showing.`,
    },
    {
      stepNumber: 3,
      delayHours: 72,
      channel: "email",
      templateKey: "listing_inquiry_followup_day3",
      subject: `Would you like similar homes too?`,
      message: `Hi ${firstName},

If ${input.listingAddress} isn't the perfect fit, we can also send similar homes in the same area and price range.

Reply here and we'll put together options for you.`,
    },
  ];
}

export async function queueListingLeadSequence(input: ListingSequenceInput) {
  const now = new Date();
  const sequenceKey = `listing_${input.leadId}`;
  const steps = buildListingSequence(input);

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
    variant_key: "A",
    recipient_name: input.customerName,
    recipient_email: input.customerEmail,
    recipient_phone: input.customerPhone ?? null,
    metadata: {
      source: "listing_inquiry",
      listing_id: input.listingId,
      listing_address: input.listingAddress,
      action_type: input.actionType,
      requested_time: input.requestedTime ?? null,
    },
  }));

  const { data, error } = await supabaseAdmin.from("lead_followups").insert(rows).select();

  if (error) throw error;

  for (const row of data ?? []) {
    await logLeadActivity({
      leadId: input.leadId,
      eventType: "followup_queued",
      title: `Listing follow-up step ${row.step_number} queued`,
      description: row.subject || "Listing follow-up scheduled",
      source: "listing_automation",
      actorType: "system",
      actorId: input.assignedAgentId ?? null,
      actorName: input.assignedAgentName ?? null,
      relatedFollowupId: row.id,
      metadata: {
        listingId: input.listingId,
        listingAddress: input.listingAddress,
        actionType: input.actionType,
        scheduledFor: row.scheduled_for,
      },
    });
  }

  return data;
}
