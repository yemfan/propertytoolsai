import type { ReengagementChannel, ReengagementLead } from "./types";

export function buildReengagementUserPrompt(params: {
  lead: ReengagementLead;
  channel: ReengagementChannel;
  stepType: string;
  templateHint: string | null;
}) {
  const { lead, channel, stepType, templateHint } = params;
  const lines = [
    `Write a ${channel === "sms" ? "short SMS" : "concise email body"} to re-engage a real estate CRM lead.`,
    "",
    `Step: ${stepType}`,
    `Name: ${lead.name || "there"}`,
    `City: ${lead.city || "unknown"}`,
    `State: ${lead.state || "unknown"}`,
    `Property interest: ${lead.propertyAddress || "not specified"}`,
    `Last contacted: ${lead.lastContactedAt || "unknown"}`,
    `Last activity: ${lead.lastActivityAt || "unknown"}`,
    "",
    "Tone: friendly, helpful, human — not pushy or salesy.",
    "Goal: reopen a conversation; offer help, not a hard pitch.",
    channel === "sms"
      ? "SMS: max 280 characters, plain text, no emojis overload."
      : "Email: 2 short paragraphs max, plain text.",
    templateHint ? `\nCreative direction from agent template:\n${templateHint}` : "",
    "",
    'Return JSON only: {"body": string, "subject": string | null}',
    "Use subject only for email; for SMS set subject to null.",
  ];
  return lines.filter(Boolean).join("\n");
}
