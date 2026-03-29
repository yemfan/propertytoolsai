"use client";

import { EstimateCard } from "@/components/home-value/EstimateCard";
import { RefinementForm } from "@/components/home-value/RefinementForm";
import { ReportGate } from "@/components/home-value/ReportGate";
import { FullReport } from "@/components/home-value/FullReport";
import { NextSteps } from "@/components/home-value/NextSteps";
import {
  CompsMapPanel,
  EstimateExplainabilityPanel,
} from "@/components/home-value/CompsMapPanel";
import { ListingStyleEstimateSection } from "@/components/home-value/ListingStyleEstimateSection";
import type {
  EstimateDetails,
  EstimateResponse,
  EstimateUiState,
  LeadForm,
  UnlockReportResponse,
} from "@/lib/home-value/types";

export function EstimateResultsSection({
  uiState,
  estimateResult,
  unlockResult,
  details,
  setDetails,
  leadForm,
  setLeadForm,
  nextActions,
  onRefreshEstimate,
  onUnlockReport,
}: {
  uiState: EstimateUiState;
  estimateResult: EstimateResponse | null;
  unlockResult: UnlockReportResponse | null;
  details: EstimateDetails;
  setDetails: React.Dispatch<React.SetStateAction<EstimateDetails>>;
  leadForm: LeadForm;
  setLeadForm: React.Dispatch<React.SetStateAction<LeadForm>>;
  nextActions: string[];
  onRefreshEstimate: () => void;
  onUnlockReport: () => void;
}) {
  if (!estimateResult) return null;

  const subject = {
    address: estimateResult.property.fullAddress,
    lat: estimateResult.property.lat,
    lng: estimateResult.property.lng,
    sqft: estimateResult.property.sqft,
    estimateValue: estimateResult.estimate.value,
    rangeLow: estimateResult.estimate.rangeLow,
    rangeHigh: estimateResult.estimate.rangeHigh,
    confidence: estimateResult.estimate.confidence,
    confidenceScore: estimateResult.estimate.confidenceScore,
    medianPpsf: estimateResult.supportingData.medianPpsf,
    weightedPpsf: estimateResult.supportingData.weightedPpsf,
    summary: estimateResult.estimate.summary,
    adjustments: estimateResult.adjustments,
  } as const;

  return (
    <div className="space-y-6">
      <EstimateCard result={estimateResult} state={uiState} />

      <ListingStyleEstimateSection
        property={{
          fullAddress: estimateResult.property.fullAddress,
          city: estimateResult.property.city,
          state: estimateResult.property.state,
          zip: estimateResult.property.zip,
          beds: estimateResult.property.beds,
          baths: estimateResult.property.baths,
          sqft: estimateResult.property.sqft,
          lotSize: estimateResult.property.lotSize,
          yearBuilt: estimateResult.property.yearBuilt,
          propertyType: estimateResult.property.propertyType,
          estimateValue: estimateResult.estimate.value,
          rangeLow: estimateResult.estimate.rangeLow,
          rangeHigh: estimateResult.estimate.rangeHigh,
          confidence: estimateResult.estimate.confidence,
          confidenceScore: estimateResult.estimate.confidenceScore,
          medianPpsf: estimateResult.supportingData.medianPpsf,
          weightedPpsf: estimateResult.supportingData.weightedPpsf,
          summary: estimateResult.estimate.summary,
        }}
      >
        <EstimateExplainabilityPanel subject={subject} />
        <CompsMapPanel subject={subject} comps={estimateResult.comps} />
      </ListingStyleEstimateSection>

      <RefinementForm
        details={details}
        onChange={(patch) => setDetails((prev) => ({ ...prev, ...patch }))}
        onRefresh={onRefreshEstimate}
        isBusy={uiState === "refining"}
      />

      <ReportGate
        open={uiState !== "report_unlocked"}
        form={leadForm}
        onFormChange={(patch) => setLeadForm((prev) => ({ ...prev, ...patch }))}
        onUnlock={onUnlockReport}
        isBusy={uiState === "unlocking"}
      />

      <FullReport estimate={estimateResult} unlockResult={unlockResult} />

      {uiState === "report_unlocked" ? <NextSteps actions={nextActions} /> : null}
    </div>
  );
}
