import { describe, it, expect } from "vitest";
import {
  computeApprovalTransition,
  findCurrentPendingStep,
  type StepLike,
} from "./approval-state";

function steps(...orders: number[]): StepLike[] {
  return orders.map((step_order) => ({ step_order, status: "waiting" }));
}

describe("findCurrentPendingStep", () => {
  const s: StepLike[] = [
    { id: "a", step_order: 1, status: "approved" },
    { id: "b", step_order: 2, status: "pending" },
    { id: "c", step_order: 3, status: "waiting" },
  ];

  it("returns the pending step matching the current step number", () => {
    expect(findCurrentPendingStep(s, 2)?.id).toBe("b");
  });

  it("returns undefined when the current step isn't pending", () => {
    expect(findCurrentPendingStep(s, 1)).toBeUndefined(); // already approved
    expect(findCurrentPendingStep(s, 3)).toBeUndefined(); // still waiting
  });

  it("returns undefined for an out-of-range step", () => {
    expect(findCurrentPendingStep(s, 99)).toBeUndefined();
  });
});

describe("computeApprovalTransition — single-step chain", () => {
  const one = steps(1);

  it("approving the only step finalizes as approved", () => {
    expect(computeApprovalTransition(1, one, "approved")).toEqual({
      requestStatus: "approved",
      nextStep: 1,
      finalized: true,
    });
  });

  it("rejecting the only step finalizes as rejected", () => {
    expect(computeApprovalTransition(1, one, "rejected")).toEqual({
      requestStatus: "rejected",
      nextStep: 1,
      finalized: true,
    });
  });
});

describe("computeApprovalTransition — multi-step chain", () => {
  const three = steps(1, 2, 3);

  it("approving a non-final step advances and stays pending", () => {
    expect(computeApprovalTransition(1, three, "approved")).toEqual({
      requestStatus: "pending",
      nextStep: 2,
      finalized: false,
    });
    expect(computeApprovalTransition(2, three, "approved")).toEqual({
      requestStatus: "pending",
      nextStep: 3,
      finalized: false,
    });
  });

  it("approving the final step finalizes as approved", () => {
    expect(computeApprovalTransition(3, three, "approved")).toEqual({
      requestStatus: "approved",
      nextStep: 3,
      finalized: true,
    });
  });

  it("rejecting at any step finalizes as rejected immediately", () => {
    for (const at of [1, 2, 3]) {
      expect(computeApprovalTransition(at, three, "rejected")).toEqual({
        requestStatus: "rejected",
        nextStep: at,
        finalized: true,
      });
    }
  });

  it("a full approval walk reaches approved exactly once", () => {
    let current = 1;
    const visited: string[] = [];
    // simulate walking the chain
    for (let i = 0; i < 5; i++) {
      const t = computeApprovalTransition(current, three, "approved");
      visited.push(t.requestStatus);
      if (t.finalized) break;
      current = t.nextStep;
    }
    expect(visited).toEqual(["pending", "pending", "approved"]);
  });
});

describe("computeApprovalTransition — ordering & edges", () => {
  it("derives chain length from max step_order, not array order", () => {
    const shuffled = steps(3, 1, 2);
    expect(computeApprovalTransition(3, shuffled, "approved").finalized).toBe(true);
    expect(computeApprovalTransition(1, shuffled, "approved")).toEqual({
      requestStatus: "pending",
      nextStep: 2,
      finalized: false,
    });
  });

  it("treats an empty chain as immediately terminal", () => {
    expect(computeApprovalTransition(1, [], "approved")).toEqual({
      requestStatus: "approved",
      nextStep: 1,
      finalized: true,
    });
    expect(computeApprovalTransition(1, [], "rejected")).toEqual({
      requestStatus: "rejected",
      nextStep: 1,
      finalized: true,
    });
  });
});
