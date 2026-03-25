import { logLeadActivity } from "@/lib/activity/logLeadActivity";
import { addConversationMessage } from "@/lib/home-value/conversation";
import { autoAssignListingLead } from "@/lib/listings/lead-routing";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { BuyerPreferences, PropertyMatch } from "@/lib/match/types";

function addHours(d: Date, hours: number) {
  return new Date(d.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function firstName(name: string) {
  const t = name.trim();
  return t ? t.split(/\s+/)[0] : "there";
}

export async function runSmartMatchUnlockAutomation(input: {
  leadId: string;
  name: string;
  email: string;
  phone?: string | null;
  preferences: BuyerPreferences;
  topMatch: PropertyMatch | null;
}) {
  const { leadId, name, email, phone, preferences, topMatch } = input;
  let assignedAgentId: string | null = null;
  let assignedAgentName: string | null = null;

  try {
    const assigned = await autoAssignListingLead(leadId, undefined, preferences.city);
    if (assigned) {
      assignedAgentId = assigned.agentId;
      assignedAgentName = assigned.fullName;
    }
  } catch (e) {
    console.warn("smart match: agent assignment skipped", e);
  }

  const city = preferences.city || "your area";
  const budgetStr =
    typeof preferences.budget === "number"
      ? `$${preferences.budget.toLocaleString()}`
      : "your budget";

  const seedMessage = `Hi, I'm interested in homes around ${city} with a budget near ${budgetStr}. I saw a match like ${topMatch?.address || "a property"} and would like more details and similar options.`;

  try {
    await addConversationMessage({
      leadId,
      direction: "inbound",
      channel: "chat",
      subject: null,
      message: seedMessage,
      senderName: name,
      senderEmail: email,
      status: "received",
    });
  } catch (e) {
    console.warn("smart match: conversation seed skipped", e);
  }

  const now = new Date();
  const sequenceKey = `smart_match_${leadId}`;
  const fn = firstName(name);

  const steps = [
    {
      delayHours: 0,
      templateKey: "smart_match_instant_response",
      subject: `Your home search in ${city}`,
      message: `Hi ${fn},

I saw your home preferences and a few strong matches in ${city}. I can line up the best options and help you compare them quickly—would you like to see 3–5 homes that fit your budget right now?

${assignedAgentName ? `${assignedAgentName} can help with next steps.` : "Our team will help with next steps."}`,
    },
    {
      delayHours: 24,
      templateKey: "smart_match_followup_1",
      message: `Hi ${fn},

Just checking in—do you want me to prioritize homes with ${preferences.beds ?? "your"}+ beds or focus on best value deals under ${budgetStr}?`,
    },
    {
      delayHours: 48,
      templateKey: "smart_match_followup_2",
      message: `Hi ${fn},

I also have a few off-market and coming-soon homes in ${city}. Want me to send those over?`,
    },
  ];

  try {
    const rows = steps.map((step, i) => ({
      lead_id: leadId,
      assigned_agent_id: assignedAgentId,
      channel: "email" as const,
      subject: step.subject ?? null,
      message: step.message,
      status: "pending",
      step_number: i + 1,
      scheduled_for: addHours(now, step.delayHours),
      sequence_key: sequenceKey,
      template_key: step.templateKey,
      variant_key: "A",
      recipient_name: name,
      recipient_email: email,
      recipient_phone: phone ?? null,
      metadata: {
        source: "smart_property_match",
        preferences,
        topMatch,
      },
    }));

    const { data: followups, error } = await supabaseAdmin.from("lead_followups").insert(rows).select();
    if (error) throw error;

    for (const row of followups ?? []) {
      await logLeadActivity({
        leadId,
        eventType: "followup_queued",
        title: `Smart Match follow-up step ${row.step_number} queued`,
        description: row.subject || "Smart Match follow-up scheduled",
        source: "smart_match_automation",
        actorType: "system",
        actorId: assignedAgentId,
        actorName: assignedAgentName,
        relatedFollowupId: row.id,
        metadata: {
          templateKey: row.template_key,
          scheduledFor: row.scheduled_for,
        },
      });
    }
  } catch (e) {
    console.warn("smart match: follow-up queue skipped", e);
  }

  try {
    await logLeadActivity({
      leadId,
      eventType: "automation_started",
      title: "Smart Match automation started",
      description: "Lead entered Smart Match follow-up sequence",
      source: "smart_property_match",
      actorType: "system",
      actorId: assignedAgentId,
      actorName: assignedAgentName,
      metadata: {
        assignedAgentId: assignedAgentId ?? null,
        topMatchAddress: topMatch?.address ?? null,
      },
    });
  } catch (e) {
    console.warn("smart match: automation activity log skipped", e);
  }
}
