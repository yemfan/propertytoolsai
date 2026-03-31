/**
 * Raw lead row shape returned by LeadSmart AI dashboard/list JSON APIs (snake_case).
 * Map to {@link Lead} / {@link LeadCrm} on the client when a normalized model is preferred.
 */
export type LeadRowSnake = {
  id: string;
  agent_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  property_address: string | null;
  source: string | null;
  lead_status: string | null;
  notes?: string | null;
  engagement_score?: number | null;
  last_activity_at?: string | null;
  rating?: string | null;
  contact_frequency?: string | null;
  contact_method?: string | null;
  last_contacted_at?: string | null;
  next_contact_at?: string | null;
  search_location?: string | null;
  search_radius?: number | null;
  price_min?: number | null;
  price_max?: number | null;
  beds?: number | null;
  baths?: number | null;
  created_at: string;
  pipeline_stage_id?: string | null;
  /** Hydrated from `lead_scores` on list endpoints */
  ai_lead_score?: number | null;
  ai_intent?: string | null;
  ai_timeline?: string | null;
  ai_confidence?: number | null;
  ai_explanation?: string[] | null;
};
