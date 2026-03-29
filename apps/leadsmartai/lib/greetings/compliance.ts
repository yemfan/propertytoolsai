import type { GreetingChannel, GreetingLead } from "./types";

export function canSendGreeting(lead: GreetingLead, channel: GreetingChannel) {
  if (channel === "sms") {
    if (lead.contactOptOutSms) return { allowed: false as const, reason: "sms_opt_out" };
    if (lead.smsOptIn === false) return { allowed: false as const, reason: "sms_not_opted_in" };
    const phone = (lead.phone || "").trim();
    if (!phone) return { allowed: false as const, reason: "missing_phone" };
  }

  if (channel === "email") {
    if (lead.contactOptOutEmail) return { allowed: false as const, reason: "email_opt_out" };
    if (!(lead.email || "").trim()) return { allowed: false as const, reason: "missing_email" };
  }

  return { allowed: true as const, reason: null as string | null };
}

export function chooseGreetingChannel(
  lead: GreetingLead,
  preferred: "sms" | "email" | "smart"
): GreetingChannel {
  if (preferred === "sms") return "sms";
  if (preferred === "email") return "email";

  const pref = (lead.preferredContactChannel || "").toLowerCase();
  if (pref === "sms" && (lead.phone || "").trim() && !lead.contactOptOutSms && lead.smsOptIn !== false) {
    return "sms";
  }
  if (pref === "email" && (lead.email || "").trim() && !lead.contactOptOutEmail) {
    return "email";
  }
  if (pref === "both") {
    if ((lead.phone || "").trim() && !lead.contactOptOutSms && lead.smsOptIn !== false) return "sms";
    if ((lead.email || "").trim() && !lead.contactOptOutEmail) return "email";
  }
  if ((lead.phone || "").trim() && !lead.contactOptOutSms && lead.smsOptIn !== false) return "sms";
  return "email";
}
