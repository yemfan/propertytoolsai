export type GreetingEventType = "birthday" | "holiday" | "home_anniversary" | "checkin";

export type GreetingChannel = "sms" | "email";

export type GreetingAutomationSettings = {
  agentId: string;
  birthdayEnabled: boolean;
  holidayEnabled: boolean;
  homeAnniversaryEnabled: boolean;
  checkinEnabled: boolean;
  preferredChannel: "sms" | "email" | "smart";
  tone: "friendly" | "professional" | "luxury";
  sendHourLocal: number;
  useAiPersonalization: boolean;
};

export type GreetingLead = {
  id: string;
  assignedAgentId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  birthday?: string | null;
  homePurchaseDate?: string | null;
  preferredContactChannel?: string | null;
  relationshipStage?: string | null;
  contactOptOutSms: boolean;
  contactOptOutEmail: boolean;
  smsOptIn?: boolean;
  lastContactedAt?: string | null;
  leadTemperature?: string | null;
  leadTags?: string[];
};

export type GreetingEvent = {
  type: GreetingEventType;
  holidayKey?: string;
  scheduledDate: string;
};

export type GeneratedGreeting = {
  eventType: GreetingEventType;
  channel: GreetingChannel;
  subject?: string | null;
  body: string;
  tags: string[];
};
