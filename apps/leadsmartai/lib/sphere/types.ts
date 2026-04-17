export type SphereRelationshipType =
  | "past_buyer_client"
  | "past_seller_client"
  | "sphere_non_client"
  | "referral_source";

export type SphereSignalType =
  | "equity_milestone"
  | "refi_detected"
  | "job_change"
  | "dormant"
  | "life_event_other"
  | "comparable_sale";

export type SphereSignal = {
  id: string;
  contactId: string;
  type: SphereSignalType;
  label: string;
  confidence: "low" | "medium" | "high";
  suggestedAction: string | null;
  payload: Record<string, unknown>;
  detectedAt: string;
  acknowledgedAt: string | null;
  dismissedAt: string | null;
};

export type SphereContact = {
  id: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  initials: string;
  avatarColor: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  closingAddress: string | null;
  closingDate: string | null;
  closingPrice: number | null;
  avmCurrent: number | null;
  avmUpdatedAt: string | null;
  relationshipType: SphereRelationshipType;
  relationshipTag: string | null;
  anniversaryOptIn: boolean;
  preferredLanguage: "en" | "zh";
  lastTouchDate: string | null;
  doNotContactSms: boolean;
  doNotContactEmail: boolean;
};

/** Derived fields layered on top of the raw contact for the UI. */
export type SphereContactView = SphereContact & {
  equityDelta: number | null;
  equityPct: number | null;
  dormancyDays: number | null;
  topReason: string;
  reasonType:
    | "anniversary"
    | "equity_milestone"
    | "dormant"
    | "life_event"
    | "referral_overdue"
    | "none";
  priority: number;
  signals: SphereSignal[];
};
