"use client";

import { useCallback, useState } from "react";
import LeadCaptureModal from "@/components/LeadCaptureModal";
import { createExpertLead } from "@/lib/leads";
import { trackAgentClicked, trackEvent } from "@/lib/tracking";
import type { PropertyInput } from "@/lib/propertyScoring";

export type ExpertCTAProps = {
  /** Typically row 1 / CMA subject */
  subjectProperty: PropertyInput;
  /** Full comparison snapshot */
  comparisonRows: PropertyInput[];
  /** Result from “Generate AI insight”, if any */
  aiRecommendation: {
    bestPropertyId: string;
    explanation: string;
    pros: string[];
    cons: string[];
  } | null;
  className?: string;
};

function serializeProperty(p: PropertyInput): Record<string, unknown> {
  return {
    id: p.id,
    address: p.address,
    price: p.price,
    beds: p.beds,
    baths: p.baths,
    sqft: p.sqft,
    rentMonthly: p.rentMonthly ?? null,
  };
}

export default function ExpertCTA({
  subjectProperty,
  comparisonRows,
  aiRecommendation,
  className = "",
}: ExpertCTAProps) {
  const [open, setOpen] = useState(false);

  const onTalkClick = useCallback(() => {
    void trackEvent("expert_cta_clicked", {
      source: "ai_comparison",
      has_ai: Boolean(aiRecommendation),
      row_count: comparisonRows.length,
    });
    void trackAgentClicked({
      source: "expert_cta",
      context: "ai_property_comparison",
    });
    setOpen(true);
  }, [aiRecommendation, comparisonRows.length]);

  const customSubmit = useCallback(
    async (payload: { name: string; email: string; phone: string }) => {
      const res = await createExpertLead({
        name: payload.name,
        email: payload.email,
        phone: payload.phone || undefined,
        subject_property: serializeProperty(subjectProperty),
        comparison_properties: comparisonRows.map(serializeProperty),
        ai_recommendation: aiRecommendation
          ? {
              bestPropertyId: aiRecommendation.bestPropertyId,
              explanation: aiRecommendation.explanation,
              pros: aiRecommendation.pros,
              cons: aiRecommendation.cons,
            }
          : null,
        source: "ai_comparison",
      });
      if (!res.ok) {
        return { ok: false as const, error: res.error };
      }
      return {
        ok: true as const,
        leadId: res.leadId,
        matched_agent_ids: res.matched_agent_ids,
      };
    },
    [subjectProperty, comparisonRows, aiRecommendation]
  );

  return (
    <>
      <div
        className={`rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm ${className}`}
      >
        <p className="text-sm font-semibold text-slate-900">Want expert advice on this deal?</p>
        <p className="mt-1 text-xs text-slate-600">
          A licensed agent can review your comparison and AI insight and reach out with next steps.
        </p>
        <button
          type="button"
          onClick={onTalkClick}
          className="mt-4 w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 sm:w-auto sm:px-8"
        >
          Talk to an Expert
        </button>
      </div>

      <LeadCaptureModal
        open={open}
        onOpenChange={setOpen}
        source="ai_comparison"
        tool="ai_property_comparison"
        intent="buy"
        propertyAddress={subjectProperty.address}
        title="Connect with an expert"
        subtitle="Share your contact info — we’ll route you to a matched agent who can discuss this comparison."
        submitLabel="Request expert call"
        customSubmit={customSubmit}
      />
    </>
  );
}
