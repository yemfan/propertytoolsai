import twilio from "twilio";

export type NotifyAssignedAgentChatSmsParams = {
  toPhoneE164: string;
  agentDisplayName: string;
  customerName: string;
  conversationPublicId: string;
};

/**
 * SMS the agent a deep link to LeadSmart support inbox (opens conversation by public id when UI supports it).
 */
export async function notifyAssignedAgentChatSms(
  params: NotifyAssignedAgentChatSmsParams
): Promise<{ sent: boolean; reason?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();
  const leadsmartBase =
    process.env.NEXT_PUBLIC_LEADSMART_URL?.trim().replace(/\/$/, "") ||
    process.env.LEADSMART_APP_URL?.trim().replace(/\/$/, "");

  if (!sid || !token || !from) {
    return { sent: false, reason: "twilio_not_configured" };
  }
  if (!leadsmartBase) {
    return { sent: false, reason: "leadsmart_url_missing" };
  }

  const openUrl = `${leadsmartBase}/dashboard/support?conversation=${encodeURIComponent(params.conversationPublicId)}`;

  const body = [
    `PropertyTools: ${params.customerName} started a chat.`,
    `Open: ${openUrl}`,
  ].join(" ");

  try {
    const client = twilio(sid, token);
    await client.messages.create({
      from,
      to: params.toPhoneE164,
      body: body.slice(0, 1600),
    });
    return { sent: true };
  } catch (e) {
    console.error("[notifyAssignedAgentChatSms]", e);
    return { sent: false, reason: e instanceof Error ? e.message : "twilio_error" };
  }
}
