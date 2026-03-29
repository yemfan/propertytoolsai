export type PipelineStageId =
  | "intro"
  | "search"
  | "offer"
  | "contract"
  | "inspection"
  | "appraisal"
  | "closing";

export type PipelineStage = {
  id: PipelineStageId;
  label: string;
  description: string;
};

export const CLIENT_PIPELINE_STAGES: PipelineStage[] = [
  { id: "intro", label: "Connected", description: "You and your agent are aligned on goals." },
  { id: "search", label: "Search", description: "Touring homes and refining criteria." },
  { id: "offer", label: "Offer", description: "Submitting or negotiating an offer." },
  { id: "contract", label: "Under contract", description: "Mutual acceptance — opening escrow." },
  { id: "inspection", label: "Due diligence", description: "Inspections, disclosures, repairs." },
  { id: "appraisal", label: "Appraisal & loan", description: "Lender appraisal and clear-to-close." },
  { id: "closing", label: "Closing", description: "Signing, funding, and keys." },
];

/**
 * Map coarse CRM status → pipeline index (heuristic; agents can refine later).
 */
export function pipelineIndexForLeadStatus(leadStatus: string | null | undefined): number {
  const s = String(leadStatus ?? "new").toLowerCase();
  if (s === "closed") return 6;
  if (s === "qualified") return 3;
  if (s === "contacted") return 1;
  return 0;
}

export function buildPipelineState(leadStatus: string | null | undefined): {
  stages: PipelineStage[];
  activeIndex: number;
} {
  const idx = Math.min(
    CLIENT_PIPELINE_STAGES.length - 1,
    Math.max(0, pipelineIndexForLeadStatus(leadStatus))
  );
  return { stages: CLIENT_PIPELINE_STAGES, activeIndex: idx };
}
