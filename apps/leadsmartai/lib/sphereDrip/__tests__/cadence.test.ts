import { describe, expect, it } from "vitest";

import {
  BOTH_HIGH_CADENCE,
  BOTH_HIGH_CADENCE_KEY,
  cadenceDurationDays,
  computeNextDueAt,
  getStepAt,
  renderStepBody,
  renderStepSubject,
} from "@/lib/sphereDrip/cadence";

describe("BOTH_HIGH_CADENCE — shape", () => {
  it("has 6 steps that match totalSteps", () => {
    expect(BOTH_HIGH_CADENCE.steps).toHaveLength(6);
    expect(BOTH_HIGH_CADENCE.totalSteps).toBe(6);
  });

  it("step indexes are 0..5 in order", () => {
    expect(BOTH_HIGH_CADENCE.steps.map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("step 0 fires same-day as enrollment (daysAfterPrevious = 0)", () => {
    expect(BOTH_HIGH_CADENCE.steps[0].daysAfterPrevious).toBe(0);
  });

  it("each subsequent step has positive spacing", () => {
    for (let i = 1; i < BOTH_HIGH_CADENCE.steps.length; i++) {
      expect(BOTH_HIGH_CADENCE.steps[i].daysAfterPrevious).toBeGreaterThan(0);
    }
  });

  it("alternates SMS and email channels", () => {
    expect(BOTH_HIGH_CADENCE.steps.map((s) => s.channel)).toEqual([
      "sms",
      "email",
      "sms",
      "email",
      "sms",
      "email",
    ]);
  });

  it("email steps have a subject; SMS steps don't", () => {
    for (const s of BOTH_HIGH_CADENCE.steps) {
      if (s.channel === "email") {
        expect(s.subject).toBeTruthy();
      } else {
        expect(s.subject).toBeUndefined();
      }
    }
  });

  it("uses the v1 cadence key", () => {
    expect(BOTH_HIGH_CADENCE.key).toBe(BOTH_HIGH_CADENCE_KEY);
    expect(BOTH_HIGH_CADENCE_KEY).toBe("both_high_v1");
  });
});

describe("getStepAt", () => {
  it("returns step 0 when currentStep=0", () => {
    expect(getStepAt(BOTH_HIGH_CADENCE, 0)?.index).toBe(0);
  });

  it("returns step N when currentStep=N (N < totalSteps)", () => {
    expect(getStepAt(BOTH_HIGH_CADENCE, 3)?.index).toBe(3);
  });

  it("returns null when currentStep >= totalSteps (cadence complete)", () => {
    expect(getStepAt(BOTH_HIGH_CADENCE, 6)).toBeNull();
    expect(getStepAt(BOTH_HIGH_CADENCE, 100)).toBeNull();
  });

  it("returns null for negative currentStep (defensive)", () => {
    expect(getStepAt(BOTH_HIGH_CADENCE, -1)).toBeNull();
  });
});

describe("computeNextDueAt", () => {
  const ENROLLED = "2026-04-27T10:00:00.000Z";

  it("step 0 anchors on enrolledAt + 0 days = same instant", () => {
    expect(computeNextDueAt(BOTH_HIGH_CADENCE, 0, ENROLLED, null)).toBe(ENROLLED);
  });

  it("step 1 anchors on lastSentAt + step1.daysAfterPrevious", () => {
    const sentAt = "2026-04-27T10:30:00.000Z";
    const expected = new Date(
      Date.parse(sentAt) + BOTH_HIGH_CADENCE.steps[1].daysAfterPrevious * 86_400_000,
    ).toISOString();
    expect(computeNextDueAt(BOTH_HIGH_CADENCE, 1, ENROLLED, sentAt)).toBe(expected);
  });

  it("falls back to enrolledAt when lastSentAt is null but step > 0", () => {
    const out = computeNextDueAt(BOTH_HIGH_CADENCE, 1, ENROLLED, null);
    const expected = new Date(
      Date.parse(ENROLLED) + BOTH_HIGH_CADENCE.steps[1].daysAfterPrevious * 86_400_000,
    ).toISOString();
    expect(out).toBe(expected);
  });

  it("returns null when cadence is complete", () => {
    expect(
      computeNextDueAt(BOTH_HIGH_CADENCE, 6, ENROLLED, "2026-05-27T10:00:00.000Z"),
    ).toBeNull();
  });

  it("returns null on unparseable anchor timestamp (defensive)", () => {
    expect(computeNextDueAt(BOTH_HIGH_CADENCE, 0, "not-a-date", null)).toBeNull();
  });

  it("slip on one step shifts the rest (anchored on actual send, not enrolledAt)", () => {
    // Pretend step 0 actually sent 2 days late.
    const lateSend = new Date(Date.parse(ENROLLED) + 2 * 86_400_000).toISOString();
    const stepOneDue = computeNextDueAt(BOTH_HIGH_CADENCE, 1, ENROLLED, lateSend);
    const expected = new Date(
      Date.parse(lateSend) + BOTH_HIGH_CADENCE.steps[1].daysAfterPrevious * 86_400_000,
    ).toISOString();
    expect(stepOneDue).toBe(expected);
  });
});

describe("renderStepBody — placeholder substitution", () => {
  const step = BOTH_HIGH_CADENCE.steps[0];

  it("replaces {{firstName}} when present", () => {
    const out = renderStepBody(step, {
      firstName: "Alex",
      agentFirstName: "Sam",
      propertyAddress: "10 Elm St",
    });
    expect(out).toContain("Alex");
    expect(out).not.toContain("{{firstName}}");
  });

  it("falls back to 'there' when firstName is missing", () => {
    const out = renderStepBody(step, {
      firstName: null,
      agentFirstName: "Sam",
      propertyAddress: "10 Elm St",
    });
    expect(out).toContain("Hey there!");
    expect(out).not.toContain("{{firstName}}");
  });

  it("falls back to 'your agent' when agentFirstName is missing", () => {
    const out = renderStepBody(step, {
      firstName: "Alex",
      agentFirstName: null,
      propertyAddress: "10 Elm St",
    });
    expect(out).toContain("your agent");
    expect(out).not.toContain("{{agentFirstName}}");
  });

  it("falls back to 'the home' when propertyAddress is missing — checked on a step that uses it", () => {
    const equityStep = BOTH_HIGH_CADENCE.steps[1]; // day 3 mentions the address
    const out = renderStepBody(equityStep, {
      firstName: "Alex",
      agentFirstName: "Sam",
      propertyAddress: null,
    });
    expect(out).toContain("the home");
    expect(out).not.toContain("{{propertyAddress}}");
  });

  it("collapses multiple occurrences of the same placeholder", () => {
    // The day-0 step uses {{agentFirstName}} once; the day-30 step uses it twice.
    // Verify replaceAll behavior with a synthetic string.
    const synthetic = {
      index: 99,
      daysAfterPrevious: 0,
      channel: "sms" as const,
      label: "test",
      body: "{{firstName}} {{firstName}} {{firstName}}",
    };
    const out = renderStepBody(synthetic, {
      firstName: "X",
      agentFirstName: null,
      propertyAddress: null,
    });
    expect(out).toBe("X X X");
  });

  it("trims whitespace-only field values to the fallback", () => {
    const out = renderStepBody(step, {
      firstName: "   ",
      agentFirstName: "   ",
      propertyAddress: "   ",
    });
    expect(out).toContain("Hey there!");
    expect(out).toContain("your agent");
  });
});

describe("renderStepSubject", () => {
  it("returns null for SMS steps (no subject)", () => {
    expect(
      renderStepSubject(BOTH_HIGH_CADENCE.steps[0], {
        firstName: "Alex",
        agentFirstName: "Sam",
      }),
    ).toBeNull();
  });

  it("renders email subjects with substitution", () => {
    const out = renderStepSubject(BOTH_HIGH_CADENCE.steps[1], {
      firstName: "Alex",
      agentFirstName: "Sam",
    });
    expect(typeof out).toBe("string");
    // The day-3 subject doesn't use placeholders today, but the renderer
    // must still pass through cleanly.
    expect(out).not.toContain("{{");
  });
});

describe("cadenceDurationDays", () => {
  it("sums daysAfterPrevious across all steps", () => {
    const expected = BOTH_HIGH_CADENCE.steps.reduce((s, x) => s + x.daysAfterPrevious, 0);
    expect(cadenceDurationDays(BOTH_HIGH_CADENCE)).toBe(expected);
  });

  it("v1 cadence runs ~30 days", () => {
    // Sanity guard: the cadence isn't blowing out to 90 days or collapsing
    // to a few days — both would be a bug.
    const days = cadenceDurationDays(BOTH_HIGH_CADENCE);
    expect(days).toBeGreaterThanOrEqual(20);
    expect(days).toBeLessThanOrEqual(45);
  });
});
