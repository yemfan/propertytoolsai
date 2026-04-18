/**
 * Unified contacts types. Replaces the old `lib/sphere/types.ts` and the
 * ad-hoc `CrmLeadRow` shape used by `lib/dashboardService.ts` — a contact
 * is a contact regardless of where they are in the funnel. The
 * `lifecycleStage` discriminator drives which fields are expected to be
 * populated and which UI surface(s) the row appears in.
 */

// =============================================================================
// Enums
// =============================================================================

export type LifecycleStage =
  | "lead"
  | "active_client"
  | "past_client"
  | "sphere"
  | "referral_source"
  | "archived";

export type RelationshipType =
  | "past_buyer"
  | "past_seller"
  | "past_both"
  | "sphere"
  | "referral_source"
  | "prospect";

export type ContactRating = "A" | "B" | "C" | "D" | "unrated";

export type ContactFrequency = "daily" | "weekly" | "monthly" | "quarterly";
export type ContactMethod = "email" | "sms" | "call" | "any";

export type TcpaConsentSource =
  | "web_form"
  | "imported_with_written_consent"
  | "verbal"
  | "written"
  | "manual_entry";

export type ContactSignalType =
  | "refi_detected"
  | "equity_milestone"
  | "job_change"
  | "anniversary_due"
  | "listing_activity"
  | "life_event_other";

export type SignalConfidence = "low" | "medium" | "high";

// =============================================================================
// Core contact
// =============================================================================

export type Contact = {
  id: string;
  agentId: string;

  lifecycleStage: LifecycleStage;

  // Identity
  firstName: string | null;
  lastName: string | null;
  /** Convenience: `${firstName} ${lastName}`.trim() or email-derived fallback */
  fullName: string;
  /** First letter of first_name + first letter of last_name, uppercase. */
  initials: string;
  email: string | null;
  phone: string | null;
  /** Formatted phone used by SMS paths; kept separate for legacy compatibility. */
  phoneNumber: string | null;

  // Addresses
  /** Where the contact lives */
  address: string | null;
  /** Property they're inquiring about (leads) */
  propertyAddress: string | null;
  /** Property they closed on (past_client) */
  closingAddress: string | null;
  city: string | null;
  state: string | null;

  // Funnel metadata
  source: string | null;
  rating: ContactRating | null;
  notes: string | null;
  /** Funnel sub-state: 'new' | 'contacted' | 'qualified' | 'won' | 'lost' etc. */
  leadStatus: string | null;
  /** 'buyer' | 'seller' | 'rental' | 'investor' etc. */
  leadType: string | null;
  /** Progressive-capture stage marker. */
  stage: string | null;
  /** Free-form intent tag from form / SMS inference. */
  intent: string | null;

  // Engagement
  engagementScore: number;
  /** Legacy alternate of engagementScore used by the scoring pipeline. */
  nurtureScore: number | null;
  lastActivityAt: string | null;
  lastContactedAt: string | null;
  nextContactAt: string | null;
  contactFrequency: ContactFrequency | null;
  contactMethod: ContactMethod | null;

  // Search criteria (leads)
  searchLocation: string | null;
  searchRadius: number | null;
  priceMin: number | null;
  priceMax: number | null;
  beds: number | null;
  baths: number | null;

  // Prediction / scoring
  predictionScore: number | null;
  predictionLabel: string | null;
  predictionFactors: Record<string, unknown> | null;
  predictionComputedAt: string | null;

  // Automation
  automationDisabled: boolean;
  reportId: string | null;
  propertyId: string | null;

  // Transaction (past_client, referral_source)
  closingDate: string | null;
  closingPrice: number | null;
  avmCurrent: number | null;
  avmUpdatedAt: string | null;

  // Relationship
  relationshipType: RelationshipType | null;
  relationshipTag: string | null;
  anniversaryOptIn: boolean;

  // Consent
  preferredLanguage: string;
  doNotContactSms: boolean;
  doNotContactEmail: boolean;
  tcpaConsentAt: string | null;
  tcpaConsentSource: TcpaConsentSource | null;
  tcpaConsentIp: string | null;
  /** Legacy SMS opt-in flag — reconcile with tcpaConsentAt in a follow-up. */
  smsOptIn: boolean;
  // SMS state machine
  smsAiEnabled: boolean;
  smsAgentTakeover: boolean;
  smsFollowupStage: string | null;
  smsLastOutboundAt: string | null;
  smsLastInboundAt: string | null;

  // Pipeline
  pipelineStageId: string | null;

  // Display
  avatarColor: string;

  createdAt: string;
  updatedAt: string;
};

// =============================================================================
// Derived view — what the UI actually renders
// =============================================================================

export type ContactReasonType =
  | "anniversary"
  | "equity_milestone"
  | "dormant"
  | "life_event"
  | "referral_overdue"
  | "new_lead"
  | "active_deal"
  | "none";

export type ContactView = Contact & {
  // Equity fields — populated when closingPrice and avmCurrent are both set.
  equityDelta: number | null;
  equityPct: number | null;
  // Days since last contact. Null if never contacted.
  dormancyDays: number | null;
  // One-line reason the agent should touch this contact today.
  topReason: string;
  reasonType: ContactReasonType;
  // Lower = more urgent.
  priority: number;
  signals: ContactSignal[];
};

// =============================================================================
// Signals
// =============================================================================

export type ContactSignal = {
  id: string;
  contactId: string;
  type: ContactSignalType;
  label: string;
  confidence: SignalConfidence;
  suggestedAction: string | null;
  payload: Record<string, unknown>;
  detectedAt: string;
  acknowledgedAt: string | null;
  dismissedAt: string | null;
};

// =============================================================================
// Smart Lists
// =============================================================================

/**
 * Filter config stored in `smart_lists.filter_config` (jsonb) and applied
 * by `resolveContactsForFilter()`. All fields optional — omitted fields
 * are not constrained. Multi-value fields use OR semantics within the
 * field and AND semantics across fields.
 */
export type ContactFilterConfig = {
  /** Match any of these lifecycle stages. */
  lifecycle_stage?: LifecycleStage[];
  /** Exclude these lifecycle stages (useful for "All except archived"). */
  exclude_lifecycle_stage?: LifecycleStage[];

  /** Match any of these ratings. */
  rating?: ContactRating[];
  /** Match any of these relationship types. */
  relationship_type?: RelationshipType[];
  /** Match any of these sources (case-insensitive). */
  source?: string[];

  /** Only contacts with at least one open (not dismissed) signal. */
  has_open_signals?: boolean;

  /** Dormancy: last_contacted_at is null OR older than N days ago. */
  dormant_days_gte?: number;
  /** Activity: updated_at within the last N days. */
  updated_within_days?: number;

  /** Free-text query matching name/email/phone/address (ilike). */
  query?: string;

  /** Must be within specific price range. */
  price_min?: number;
  price_max?: number;
};

export type SmartList = {
  id: string;
  agentId: string;
  name: string;
  description: string | null;
  icon: string | null;
  filterConfig: ContactFilterConfig;
  sortOrder: number;
  isDefault: boolean;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
};

// =============================================================================
// CSV import
// =============================================================================

export type ContactImportRow = {
  lifecycleStage?: LifecycleStage;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  propertyAddress?: string;
  closingAddress?: string;
  closingDate?: string;
  closingPrice?: number;
  relationshipType?: RelationshipType;
  relationshipTag?: string;
  anniversaryOptIn?: boolean;
  preferredLanguage?: string;
  source?: string;
  rating?: ContactRating;
  notes?: string;
  tcpaConsentAt?: string;
  tcpaConsentSource?: TcpaConsentSource;
};
