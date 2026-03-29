/** Canonical pipeline slugs for LeadSmart mobile (map to `crm_pipeline_stages` on the server). */
export const MOBILE_PIPELINE_SLUGS = [
  "new",
  "contacted",
  "qualified",
  "showing",
  "offer",
  "closed",
] as const;

export type MobilePipelineSlug = (typeof MOBILE_PIPELINE_SLUGS)[number];

export const MOBILE_PIPELINE_LABELS: Record<MobilePipelineSlug, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  showing: "Showing",
  offer: "Offer",
  closed: "Closed",
};
