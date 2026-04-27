import { describe, expect, it } from "vitest";

import {
  attachEnrollments,
  indexEnrollmentsByContact,
  type DripEnrollmentRow,
} from "@/lib/sphereDrip/attach";
import type { MonetizationRow } from "@/lib/sphereMonetization/mergeRows";

function row(contactId: string, overrides: Partial<MonetizationRow> = {}): MonetizationRow {
  return {
    contactId,
    fullName: contactId.toUpperCase(),
    email: null,
    phone: null,
    lifecycleStage: "past_client",
    closingAddress: null,
    closingDate: null,
    seller: { score: 80, label: "high", topReason: "x" },
    buyer: { score: 80, label: "high", topReason: "y" },
    combinedScore: 160,
    bothMediumOrHigh: true,
    ...overrides,
  };
}

function enrollment(
  contactId: string,
  overrides: Partial<DripEnrollmentRow> = {},
): DripEnrollmentRow {
  return {
    id: `e-${contactId}`,
    agentId: "agent-1",
    contactId,
    cadenceKey: "both_high_v1",
    enrolledAt: "2026-04-01T00:00:00.000Z",
    currentStep: 0,
    status: "active",
    lastSentAt: null,
    nextDueAt: "2026-04-01T00:00:00.000Z",
    completedAt: null,
    exitReason: null,
    ...overrides,
  };
}

describe("indexEnrollmentsByContact", () => {
  it("returns an empty map for empty input", () => {
    expect(indexEnrollmentsByContact([]).size).toBe(0);
  });

  it("indexes by contactId", () => {
    const idx = indexEnrollmentsByContact([enrollment("a"), enrollment("b")]);
    expect(idx.get("a")?.contactId).toBe("a");
    expect(idx.get("b")?.contactId).toBe("b");
    expect(idx.size).toBe(2);
  });
});

describe("attachEnrollments", () => {
  it("returns rows untouched when there are no enrollments", () => {
    const rows = [row("a"), row("b")];
    const out = attachEnrollments(rows, []);
    expect(out.map((r) => r.enrollment)).toEqual([null, null]);
  });

  it("attaches enrollment when contactId matches", () => {
    const rows = [row("a"), row("b")];
    const enrollments = [enrollment("a", { currentStep: 3 })];
    const out = attachEnrollments(rows, enrollments);
    expect(out[0].enrollment?.currentStep).toBe(3);
    expect(out[1].enrollment).toBeNull();
  });

  it("preserves the original row order", () => {
    const rows = [row("z"), row("a"), row("m")];
    const out = attachEnrollments(rows, [enrollment("a")]);
    expect(out.map((r) => r.contactId)).toEqual(["z", "a", "m"]);
  });

  it("ignores enrollments without a matching row", () => {
    const out = attachEnrollments([row("a")], [enrollment("orphan")]);
    expect(out).toHaveLength(1);
    expect(out[0].enrollment).toBeNull();
  });

  it("includes status / nextDueAt / currentStep on the attached enrollment", () => {
    const e = enrollment("a", {
      status: "completed",
      currentStep: 6,
      nextDueAt: null,
      completedAt: "2026-05-15T00:00:00.000Z",
    });
    const out = attachEnrollments([row("a")], [e]);
    expect(out[0].enrollment?.status).toBe("completed");
    expect(out[0].enrollment?.currentStep).toBe(6);
    expect(out[0].enrollment?.nextDueAt).toBeNull();
    expect(out[0].enrollment?.completedAt).toBe("2026-05-15T00:00:00.000Z");
  });
});
