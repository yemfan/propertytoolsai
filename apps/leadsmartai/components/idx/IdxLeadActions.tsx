"use client";

import { useState } from "react";

import IdxLeadCaptureModal, {
  type IdxLeadAction,
  type IdxLeadContext,
} from "@/components/idx/IdxLeadCaptureModal";

/**
 * Action buttons rendered on the PDP. Each button opens the lead-capture modal
 * pre-seeded with the listing context and a specific intent. The intent maps
 * to a `lead_status` rating + downstream AI follow-up tone (warm vs hot).
 */
export default function IdxLeadActions(props: {
  listingId: string;
  listingAddress: string;
  listingPrice: number | null;
}) {
  const [openAction, setOpenAction] = useState<IdxLeadAction | null>(null);

  const baseContext: Omit<IdxLeadContext, "action"> = {
    listingId: props.listingId,
    listingAddress: props.listingAddress,
    listingPrice: props.listingPrice,
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpenAction("schedule_tour")}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Schedule a tour
        </button>
        <button
          type="button"
          onClick={() => setOpenAction("contact_agent")}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Talk to an agent
        </button>
        <button
          type="button"
          onClick={() => setOpenAction("favorite")}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          Save home
        </button>
      </div>

      <IdxLeadCaptureModal
        open={openAction !== null}
        onClose={() => setOpenAction(null)}
        context={openAction ? { ...baseContext, action: openAction } : { ...baseContext, action: "favorite" }}
      />
    </>
  );
}
