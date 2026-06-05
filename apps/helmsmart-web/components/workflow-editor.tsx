"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { createApprovalWorkflow, updateApprovalWorkflow, deleteApprovalWorkflow } from "@/lib/actions/approval-chains";

const TRIGGER_TYPES = [
  { value: "manual", label: "Manual trigger", description: "Started manually from a record" },
  { value: "estimate_over_amount", label: "Estimate over amount", description: "Auto-triggers when estimate total exceeds threshold" },
  { value: "expense_over_amount", label: "Expense over amount", description: "Auto-triggers when expense amount exceeds threshold" },
  { value: "custom", label: "Custom", description: "For any other purpose" },
];

const ROLE_OPTIONS = [
  { value: "", label: "Any admin or owner" },
  { value: "owner", label: "Owner only" },
  { value: "admin", label: "Admin or owner" },
  { value: "bookkeeper", label: "Bookkeeper, admin, or owner" },
];

interface StepInput {
  step_name: string;
  approver_role: string;
  timeout_hours: string;
}

interface Props {
  workflowId?: string;
  initialValues?: {
    name: string;
    description: string;
    triggerType: string;
    amountThreshold: string;
    isActive: boolean;
    steps: StepInput[];
  };
}

export function WorkflowEditor({ workflowId, initialValues }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [triggerType, setTriggerType] = useState(initialValues?.triggerType ?? "manual");
  const [amountThreshold, setAmountThreshold] = useState(initialValues?.amountThreshold ?? "");
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [steps, setSteps] = useState<StepInput[]>(
    initialValues?.steps ?? [{ step_name: "Manager approval", approver_role: "admin", timeout_hours: "" }]
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addStep = () => {
    setSteps((prev) => [...prev, { step_name: `Step ${prev.length + 1}`, approver_role: "admin", timeout_hours: "" }]);
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, updates: Partial<StepInput>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  };

  const needsAmount = triggerType === "estimate_over_amount" || triggerType === "expense_over_amount";

  const handleSave = () => {
    if (!name.trim()) { setError("Workflow name is required"); return; }
    if (steps.length === 0) { setError("Add at least one approval step"); return; }
    if (needsAmount && !amountThreshold) { setError("Enter an amount threshold"); return; }
    setError(null);
    setSaved(false);

    const triggerConfig = needsAmount ? { amount_threshold: Number(amountThreshold) } : {};

    startTransition(async () => {
      const mappedSteps = steps.map((s, i) => ({
        step_order: i + 1,
        step_name: s.step_name,
        approver_role: s.approver_role || undefined,
        timeout_hours: s.timeout_hours ? Number(s.timeout_hours) : undefined,
      }));

      if (workflowId) {
        const result = await updateApprovalWorkflow(workflowId, {
          name: name.trim(),
          description: description.trim(),
          isActive,
          steps: mappedSteps,
        });
        if (!result.ok) { setError(result.error ?? "Failed to save"); return; }
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        const result = await createApprovalWorkflow({
          name: name.trim(),
          description: description.trim(),
          triggerType,
          triggerConfig,
          steps: mappedSteps,
        });
        if (!result.ok) { setError(result.error ?? "Failed to create"); return; }
        router.push(`/workflows/${result.workflowId}`);
      }
    });
  };

  const handleDelete = () => {
    if (!workflowId || !confirm("Delete this workflow?")) return;
    startTransition(async () => {
      await deleteApprovalWorkflow(workflowId);
      router.push("/workflows");
    });
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/workflows" className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-semibold text-slate-900 flex-1">
          {workflowId ? "Edit Workflow" : "New Approval Workflow"}
        </h1>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {saved ? <><CheckCircle2 className="w-3.5 h-3.5" /> Saved</> : isPending ? "Saving…" : "Save Workflow"}
        </button>
      </div>

      <div className="space-y-5">
        {/* Basic info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Workflow Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                placeholder="e.g. Large Purchase Approval"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isPending}
                placeholder="When this workflow applies"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        {/* Trigger */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Trigger</h2>
          <div className="space-y-2">
            {TRIGGER_TYPES.map((t) => (
              <label key={t.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${triggerType === t.value ? "bg-indigo-50 border-indigo-200" : "border-slate-100 hover:bg-slate-50"}`}>
                <input
                  type="radio"
                  name="trigger"
                  value={t.value}
                  checked={triggerType === t.value}
                  onChange={() => setTriggerType(t.value)}
                  disabled={!!workflowId || isPending}
                  className="mt-0.5 text-indigo-600"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">{t.label}</p>
                  <p className="text-xs text-slate-500">{t.description}</p>
                </div>
              </label>
            ))}
          </div>
          {needsAmount && (
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Amount threshold ($) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={amountThreshold}
                onChange={(e) => setAmountThreshold(e.target.value)}
                disabled={!!workflowId || isPending}
                placeholder="e.g. 5000"
                min="0"
                className="w-40 text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>
          )}
        </div>

        {/* Approval steps */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-800">Approval Steps</h2>
            <button
              type="button"
              onClick={addStep}
              disabled={isPending}
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              Add step
            </button>
          </div>
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div key={index} className="flex gap-3 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-1">
                  {index + 1}
                </div>
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Step name</label>
                    <input
                      type="text"
                      value={step.step_name}
                      onChange={(e) => updateStep(index, { step_name: e.target.value })}
                      disabled={isPending}
                      placeholder="e.g. Manager review"
                      className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Approver role</label>
                    <select
                      value={step.approver_role}
                      onChange={(e) => updateStep(index, { approver_role: e.target.value })}
                      disabled={isPending}
                      className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white disabled:opacity-60"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Auto-escalate after (hours)</label>
                    <input
                      type="number"
                      value={step.timeout_hours}
                      onChange={(e) => updateStep(index, { timeout_hours: e.target.value })}
                      disabled={isPending}
                      placeholder="Leave blank to disable"
                      min="1"
                      className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white disabled:opacity-60"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeStep(index)}
                  disabled={isPending || steps.length <= 1}
                  className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors disabled:opacity-30 flex-shrink-0 self-start mt-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Status */}
        {workflowId && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={isPending}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">Workflow is active</p>
                <p className="text-xs text-slate-500">Inactive workflows cannot accept new requests</p>
              </div>
            </label>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {workflowId && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="text-xs text-rose-600 hover:text-rose-700 font-medium disabled:opacity-50"
          >
            Delete this workflow
          </button>
        )}
      </div>
    </div>
  );
}
