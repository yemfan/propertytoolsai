/**
 * Approval-chain state machine — pure decision logic.
 *
 * Extracted from the respondToApprovalStep server action so the branching that
 * decides whether a request advances, finalizes as approved, or is rejected can
 * be unit-tested without a database. The action calls these helpers directly,
 * so the tested code is the prod code.
 */

export type ApprovalDecision = "approved" | "rejected";

export interface StepLike {
  id?: string;
  step_order: number;
  status: string; // pending | waiting | approved | rejected | skipped
}

export interface ApprovalTransition {
  /** New status for the overall request after this decision. */
  requestStatus: "pending" | "approved" | "rejected";
  /** The step the request is now on (only changes when it stays pending). */
  nextStep: number;
  /** True when the request has reached a terminal state. */
  finalized: boolean;
}

/**
 * Find the step record that is currently awaiting a decision.
 * Returns undefined if no step at `currentStep` is pending (already decided,
 * or the request is in an inconsistent state).
 */
export function findCurrentPendingStep<T extends StepLike>(
  steps: T[],
  currentStep: number
): T | undefined {
  return steps.find((s) => s.step_order === currentStep && s.status === "pending");
}

/**
 * Compute the next state of an approval request given a decision on its
 * current step.
 *
 *  - reject at any step           → request rejected (terminal)
 *  - approve the last step        → request approved (terminal)
 *  - approve a non-final step     → advance to the next step (stays pending)
 *
 * `steps` only needs step_order values; the max step_order defines the chain
 * length. Steps need not be pre-sorted.
 */
export function computeApprovalTransition(
  currentStep: number,
  steps: StepLike[],
  decision: ApprovalDecision
): ApprovalTransition {
  if (steps.length === 0) {
    // Degenerate: nothing to approve. Treat an approval as immediately complete,
    // a rejection as rejected.
    return {
      requestStatus: decision === "rejected" ? "rejected" : "approved",
      nextStep: currentStep,
      finalized: true,
    };
  }

  const maxStep = steps.reduce((m, s) => Math.max(m, s.step_order), steps[0].step_order);
  const nextStep = currentStep + 1;

  if (decision === "rejected") {
    return { requestStatus: "rejected", nextStep: currentStep, finalized: true };
  }

  if (nextStep > maxStep) {
    return { requestStatus: "approved", nextStep: maxStep, finalized: true };
  }

  return { requestStatus: "pending", nextStep, finalized: false };
}
