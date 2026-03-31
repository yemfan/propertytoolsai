/** CRM `leads.lead_status` values (LeadSmart AI dashboard). */
export const LEAD_STATUS = {
  New: "new",
  Contacted: "contacted",
  Qualified: "qualified",
  Closed: "closed",
} as const;

export type LeadStatus = (typeof LEAD_STATUS)[keyof typeof LEAD_STATUS];

/** Default ordering for dashboard status dropdowns. */
export const LEAD_STATUS_ORDER: readonly LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "closed",
];

export const CONTACT_FREQUENCY = {
  Daily: "daily",
  Weekly: "weekly",
  Monthly: "monthly",
} as const;

export type ContactFrequency = (typeof CONTACT_FREQUENCY)[keyof typeof CONTACT_FREQUENCY];

export const CONTACT_METHOD = {
  Email: "email",
  Sms: "sms",
  Both: "both",
} as const;

export type ContactMethod = (typeof CONTACT_METHOD)[keyof typeof CONTACT_METHOD];
