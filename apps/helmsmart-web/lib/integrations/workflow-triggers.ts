/**
 * Workflow Auto-Triggers
 *
 * Called after key business events to check if any workflow
 * should be automatically triggered.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { submitApprovalRequest } from "@/lib/actions/approval-chains";

/**
 * Check and trigger workflows when an estimate is created/updated.
 * Looks for active workflows with trigger_type = "estimate_over_amount"
 * and submits an approval request if the estimate total exceeds the threshold.
 */
export async function maybeTrigerEstimateWorkflow(
  orgId: string,
  estimateId: string,
  estimateTotal: number,
  estimateLabel: string,
  estimateData?: Record<string, unknown>
): Promise<void> {
  try {
    const db = await createServiceClient();

    // Find active estimate workflows
    const { data: workflows } = await db
      .from("approval_workflows")
      .select("id, name, trigger_config")
      .eq("organization_id", orgId)
      .eq("trigger_type", "estimate_over_amount")
      .eq("is_active", true);

    if (!workflows?.length) return;

    for (const wf of workflows) {
      const cfg = (wf.trigger_config ?? {}) as { amount_threshold?: number };
      const threshold = cfg.amount_threshold;

      if (!threshold || estimateTotal < threshold) continue;

      // Check if a request already exists for this estimate
      const { data: existing } = await db
        .from("approval_requests")
        .select("id")
        .eq("organization_id", orgId)
        .eq("subject_type", "estimate")
        .eq("subject_id", estimateId)
        .in("status", ["pending", "approved"])
        .maybeSingle();

      if (existing) continue; // already submitted

      // Submit approval request
      await submitApprovalRequest({
        workflowId: wf.id,
        subjectType: "estimate",
        subjectId: estimateId,
        subjectLabel: estimateLabel,
        subjectData: estimateData,
      });

      console.log(
        `[workflow-triggers] Auto-triggered estimate workflow "${wf.name}" for estimate ${estimateId} ($${estimateTotal})`
      );
    }
  } catch (e) {
    console.error("[workflow-triggers] estimate trigger error:", e);
    // Never throw — workflow triggers should never break the business action
  }
}

/**
 * Check and trigger workflows when an expense is created.
 * Looks for active workflows with trigger_type = "expense_over_amount".
 */
export async function maybeTrigerExpenseWorkflow(
  orgId: string,
  expenseId: string,
  expenseAmount: number,
  expenseLabel: string,
  expenseData?: Record<string, unknown>
): Promise<void> {
  try {
    const db = await createServiceClient();

    const { data: workflows } = await db
      .from("approval_workflows")
      .select("id, name, trigger_config")
      .eq("organization_id", orgId)
      .eq("trigger_type", "expense_over_amount")
      .eq("is_active", true);

    if (!workflows?.length) return;

    for (const wf of workflows) {
      const cfg = (wf.trigger_config ?? {}) as { amount_threshold?: number };
      const threshold = cfg.amount_threshold;

      if (!threshold || expenseAmount < threshold) continue;

      // Check for duplicate
      const { data: existing } = await db
        .from("approval_requests")
        .select("id")
        .eq("organization_id", orgId)
        .eq("subject_type", "expense")
        .eq("subject_id", expenseId)
        .in("status", ["pending", "approved"])
        .maybeSingle();

      if (existing) continue;

      await submitApprovalRequest({
        workflowId: wf.id,
        subjectType: "expense",
        subjectId: expenseId,
        subjectLabel: expenseLabel,
        subjectData: expenseData,
      });

      console.log(
        `[workflow-triggers] Auto-triggered expense workflow "${wf.name}" for expense ${expenseId} ($${expenseAmount})`
      );
    }
  } catch (e) {
    console.error("[workflow-triggers] expense trigger error:", e);
  }
}
