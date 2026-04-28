import { describe, expect, it } from "vitest";

import type { DripEnrollmentRow } from "@/lib/sphereDrip/attach";
import {
  buildReenrollmentPatch,
  decideReenrollment,
  REENROLLMENT_COOLDOWN_DAYS,
} from "@/lib/sphereDrip/reenrollment";

const NOW = "2026-04-28T12:00:00.000Z";

function row(overrides: Partial<DripEnrollmentRow> = {}): DripEnrollmentRow {
  return {
    id: "e1",
    agentId: "a1",
    contactId: "c1",
    cadenceKey: "both_high_v1",
    enrolledAt: "2026-01-01T00:00:00.000Z",
    currentStep: 0,
    status: "active",
    lastSentAt: null,
    nextDueAt: null,
    completedAt: null,
    exitReason: null,
    updatedAt: null,
    ...overrides,
  };
}

describe("decideReenrollment — non-terminal status", () => {
  it("active → skip 'still_active'", () => {
    expect(
      decideReenrollment({ prior: row({ status: "active" }), nowIso: NOW }),
    ).toEqual({ kind: "skip", reason: "still_active" });
  });

  it("paused → skip 'manually_paused' (sticky; never auto-revives)", () => {
    expect(
      decideReenrollment({ prior: row({ status: "paused" }), nowIso: NOW }),
    ).toEqual({ kind: "skip", reason: "manually_paused" });
  });
});

describe("decideReenrollment — completed status", () => {
  it("anchors on completedAt; reenrolls when cooldown elapsed", () => {
    const out = decideReenrollment({
      prior: row({
        status: "completed",
        completedAt: "2026-01-01T00:00:00.000Z", // ~117 days ago
      }),
      nowIso: NOW,
    });
    expect(out.kind).toBe("reenroll");
    if (out.kind === "reenroll") {
      expect(out.anchorIso).toBe("2026-01-01T00:00:00.000Z");
    }
  });

  it("skips when cooldown not yet elapsed", () => {
    // Completed 5 days ago; default cooldown is 30 days.
    const completedAt = new Date(
      Date.parse(NOW) - 5 * 86_400_000,
    ).toISOString();
    expect(
      decideReenrollment({
        prior: row({ status: "completed", completedAt }),
        nowIso: NOW,
      }),
    ).toEqual({ kind: "skip", reason: "cooldown_not_elapsed" });
  });

  it("falls back to updatedAt when completedAt is null", () => {
    const updatedAt = new Date(
      Date.parse(NOW) - 60 * 86_400_000,
    ).toISOString();
    const out = decideReenrollment({
      prior: row({ status: "completed", completedAt: null, updatedAt }),
      nowIso: NOW,
    });
    expect(out.kind).toBe("reenroll");
    if (out.kind === "reenroll") expect(out.anchorIso).toBe(updatedAt);
  });

  it("missing both completedAt and updatedAt → skip 'missing_anchor'", () => {
    expect(
      decideReenrollment({
        prior: row({
          status: "completed",
          completedAt: null,
          updatedAt: null,
        }),
        nowIso: NOW,
      }),
    ).toEqual({ kind: "skip", reason: "missing_anchor" });
  });
});

describe("decideReenrollment — exited status", () => {
  it("anchors on updatedAt; reenrolls past cooldown", () => {
    const updatedAt = new Date(
      Date.parse(NOW) - 60 * 86_400_000,
    ).toISOString();
    const out = decideReenrollment({
      prior: row({
        status: "exited",
        exitReason: "left_both_high_cohort",
        updatedAt,
      }),
      nowIso: NOW,
    });
    expect(out.kind).toBe("reenroll");
    if (out.kind === "reenroll") expect(out.anchorIso).toBe(updatedAt);
  });

  it("skips when exit was within cooldown window", () => {
    const updatedAt = new Date(
      Date.parse(NOW) - 10 * 86_400_000,
    ).toISOString();
    expect(
      decideReenrollment({
        prior: row({
          status: "exited",
          exitReason: "left_both_high_cohort",
          updatedAt,
        }),
        nowIso: NOW,
      }),
    ).toEqual({ kind: "skip", reason: "cooldown_not_elapsed" });
  });

  it("respects custom cooldownDays override", () => {
    // 10 days since exit; default cooldown skips, custom 7-day allows.
    const updatedAt = new Date(
      Date.parse(NOW) - 10 * 86_400_000,
    ).toISOString();
    const out = decideReenrollment({
      prior: row({ status: "exited", updatedAt }),
      nowIso: NOW,
      cooldownDays: 7,
    });
    expect(out.kind).toBe("reenroll");
  });

  it("exactly at cooldown boundary → reenroll (>= comparison)", () => {
    const updatedAt = new Date(
      Date.parse(NOW) - REENROLLMENT_COOLDOWN_DAYS * 86_400_000,
    ).toISOString();
    const out = decideReenrollment({
      prior: row({ status: "exited", updatedAt }),
      nowIso: NOW,
    });
    expect(out.kind).toBe("reenroll");
  });
});

describe("decideReenrollment — defensive", () => {
  it("unparseable nowIso → skip 'missing_anchor'", () => {
    expect(
      decideReenrollment({
        prior: row({
          status: "exited",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }),
        nowIso: "not-a-date",
      }),
    ).toEqual({ kind: "skip", reason: "missing_anchor" });
  });
});

describe("buildReenrollmentPatch", () => {
  it("returns the canonical fresh-active patch", () => {
    const patch = buildReenrollmentPatch({
      nowIso: NOW,
      nextDueAt: NOW,
    });
    expect(patch).toEqual({
      status: "active",
      current_step: 0,
      enrolled_at: NOW,
      last_sent_at: null,
      completed_at: null,
      exit_reason: null,
      next_due_at: NOW,
    });
  });

  it("accepts null nextDueAt (defensive)", () => {
    const patch = buildReenrollmentPatch({ nowIso: NOW, nextDueAt: null });
    expect(patch.next_due_at).toBeNull();
  });
});
