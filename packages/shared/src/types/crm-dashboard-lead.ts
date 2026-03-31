import type { ContactFrequency, ContactMethod, LeadStatus } from "../constants/crm-lead";
import type { LeadTemperatureLevel } from "../constants/lead-temperature";
import type { DealPredictionFactor } from "./deal-prediction";

/** Same values as {@link LEAD_TEMPERATURE} — used on `leads.rating`. */
export type LeadRating = LeadTemperatureLevel;

/**
 * Lead row shape for LeadSmart CRM dashboard / `getLeads` (snake_case, Supabase).
 */
export type CrmLeadRow = {
  id: string;
  agent_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  property_address: string | null;
  source: string | null;
  lead_status: LeadStatus;
  notes: string | null;
  engagement_score?: number | null;
  last_activity_at?: string | null;
  rating?: LeadRating | string | null;
  contact_frequency?: ContactFrequency | string | null;
  contact_method?: ContactMethod | string | null;
  last_contacted_at?: string | null;
  next_contact_at?: string | null;
  search_location: string | null;
  search_radius: number | null;
  price_min: number | null;
  price_max: number | null;
  beds: number | null;
  baths: number | null;
  created_at: string;
  nurture_score?: number | null;
  pipeline_stage_id?: string | null;
  ai_lead_score?: number | null;
  ai_intent?: string | null;
  ai_timeline?: string | null;
  ai_confidence?: number | null;
  ai_explanation?: string[] | null;
  /** Rules-based 3–6 month deal likelihood (see `lib/dealPrediction` in LeadSmart AI API). */
  prediction_score?: number | null;
  prediction_label?: string | null;
  prediction_factors?: DealPredictionFactor[] | null;
  prediction_computed_at?: string | null;
};
