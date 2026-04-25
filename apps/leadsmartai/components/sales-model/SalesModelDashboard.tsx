"use client";

import { useState } from "react";
import {
  getSalesModel,
  type SalesModelId,
} from "@/lib/sales-models";
import { updateSelectedSalesModel } from "@/lib/sales-model-storage";
import { AiSmsModal } from "./AiSmsModal";
import { DailyActionPlan } from "./DailyActionPlan";
import { IdentityBlock } from "./IdentityBlock";
import { ModelToolsGrid } from "./ModelToolsGrid";
import { PipelineView } from "./PipelineView";
import { ScriptGenerator } from "./ScriptGenerator";
import { SwitchModelModal } from "./SwitchModelModal";

/**
 * Top-level client wrapper for the sales-model dashboard.
 *
 * The server page (`/dashboard/sales-model/page.tsx`) resolves the
 * selected model from Supabase and passes the id in. From there
 * everything is client-side — section components read from the model
 * config and render themselves.
 *
 * Switching models updates local state immediately (so the UI
 * rebrands without a round-trip), then persists via the storage
 * helper. If the persist fails the modal stays open with the error.
 */
export function SalesModelDashboard({
  initialModelId,
}: {
  initialModelId: SalesModelId;
}) {
  const [modelId, setModelId] = useState<SalesModelId>(initialModelId);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const model = getSalesModel(modelId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Sales Model
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {model.name}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            {model.description}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setSmsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <SmsIcon />
            Launch AI SMS
          </button>
          <button
            type="button"
            onClick={() => setSwitchOpen(true)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          >
            Switch model
          </button>
        </div>
      </div>

      <IdentityBlock model={model} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DailyActionPlan model={model} />
        <PipelineView model={model} />
      </div>

      <ModelToolsGrid model={model} />

      <ScriptGenerator model={model} />

      <SwitchModelModal
        open={switchOpen}
        currentModel={modelId}
        onClose={() => setSwitchOpen(false)}
        onConfirm={async (next) => {
          // Optimistic UI: rebrand the dashboard the moment the user
          // confirms. Persist in the background; if the server save
          // fails we surface the error in the modal and the local
          // state stays as-is so the agent isn't locked out of the
          // new model. Worst case they re-confirm.
          setModelId(next);
          const saved = await updateSelectedSalesModel(undefined, next);
          return saved
            ? { ok: true }
            : { ok: false, error: "Saved locally, but could not sync to your account." };
        }}
      />

      <AiSmsModal
        open={smsOpen}
        model={model}
        onClose={() => setSmsOpen(false)}
      />
    </div>
  );
}

function SmsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  );
}
