import type { Lead } from "./lead";

/**
 * CRM/dashboard fields (camelCase) aligned with {@link LeadRowSnake}.
 * All extensions optional so funnels can still use the slimmer {@link Lead} shape.
 */
export type LeadCrm = Lead & {
  notes?: string | null;
  engagementScore?: number | null;
  pipelineStageId?: string | null;
  rating?: string | null;
  contactFrequency?: string | null;
  contactMethod?: string | null;
  nextContactAt?: string | null;
  searchLocation?: string | null;
  searchRadius?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
  beds?: number | null;
  baths?: number | null;
  aiLeadScore?: number | null;
  aiIntent?: string | null;
  aiTimeline?: string | null;
  aiConfidence?: number | null;
  aiExplanation?: string[] | null;
};
