import { getAgentDisplayName } from "@/lib/ai-call/lead-resolution";
import {
  describeHours,
  defaultBusinessHours,
  type ReceptionistContext,
} from "@repo/voice";

/**
 * Build the shared `ReceptionistContext` for a LeadSmart agent.
 *
 * The model-agnostic prompt/greeting/dynamic-variable builders in @repo/voice
 * consume this context. LeadSmart's structured receptionist config (business
 * hours, appointment types, knowledge base) can later come from agent-scoped
 * tables; for now we derive a working context from the agent's display name +
 * sensible defaults, so the shared builders run unchanged and the Retell agent
 * has a usable prompt. This is additive — LeadSmart's existing Twilio/OpenAI
 * voice is untouched.
 */
export async function loadReceptionistContext(agentId: string): Promise<ReceptionistContext> {
  const displayName = (await getAgentDisplayName(agentId)) || "our team";
  const timezone = "America/New_York";
  const todayISO = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return {
    orgId: agentId,
    orgName: displayName,
    orgNameZh: displayName,
    agentName: "",
    twilioNumber: null,
    timezone,
    todayISO,
    todayLabel,
    hoursText: describeHours(defaultBusinessHours()),
    typesText: "None configured — if asked to book, offer a call-back instead.",
    knowledgeText: "",
    extraNotes: "",
    greeting: "",
  };
}
