import type { MobileInboxThreadDto, MobileLeadRecordDto, MobileSmsMessageDto } from "@leadsmart/shared";

/** Stable id for local sample data (not a server lead). */
export const DEMO_LEAD_ID = "__leadsmart_demo__";

export function isDemoLeadId(id: string | undefined | null): boolean {
  return id === DEMO_LEAD_ID;
}

export function getDemoInboxThread(): MobileInboxThreadDto {
  return {
    leadId: DEMO_LEAD_ID,
    channel: "sms",
    leadName: "Alex (sample)",
    preview: "Thanks for the market update — can we tour this weekend?",
    lastMessageAt: new Date().toISOString(),
    lastDirection: "inbound",
    messageId: "demo-thread-sms",
    isHotLead: true,
  };
}

export function getDemoLeadRecord(): MobileLeadRecordDto {
  return {
    id: DEMO_LEAD_ID,
    display_phone: null,
    ai_lead_score: 72,
    ai_intent: "Buy — move-in ready",
    ai_timeline: "1–3 months",
    ai_confidence: 0.82,
    ai_explanation: ["Strong engagement pattern in sample data."],
    name: "Alex (sample)",
    email: "",
    property_address: "123 Sample Street, Austin, TX",
    lead_status: "New",
    rating: "hot",
    source: "Website",
  } as MobileLeadRecordDto;
}

export function getDemoSmsThread(): MobileSmsMessageDto[] {
  const now = Date.now();
  return [
    {
      id: "demo-sms-1",
      message: "Hi! We’re looking for a 3-bed near downtown under $650k.",
      direction: "inbound",
      created_at: new Date(now - 86_400_000 * 2).toISOString(),
    },
    {
      id: "demo-sms-2",
      message: "Absolutely — I’ll send three listings that match. Any school districts you prefer?",
      direction: "outbound",
      created_at: new Date(now - 86_400_000 * 2 + 3_600_000).toISOString(),
    },
    {
      id: "demo-sms-3",
      message: "Thanks for the market update — can we tour this weekend?",
      direction: "inbound",
      created_at: new Date(now - 3_600_000).toISOString(),
    },
  ];
}
