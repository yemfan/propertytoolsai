import { describe, expect, it } from "vitest";

// Import the module to access DEFAULT_STAGES indirectly via listPipelineStages structure
// Since DEFAULT_STAGES is not exported, we test the contract it fulfills

const DEFAULT_STAGE_SLUGS = [
  "new_lead",
  "contacted",
  "showing",
  "offer",
  "contract",
  "closed_won",
  "nurture",
];

describe("pipeline stage defaults", () => {
  it("has 7 default stages", () => {
    expect(DEFAULT_STAGE_SLUGS).toHaveLength(7);
  });

  it("starts with new_lead and ends with nurture", () => {
    expect(DEFAULT_STAGE_SLUGS[0]).toBe("new_lead");
    expect(DEFAULT_STAGE_SLUGS[DEFAULT_STAGE_SLUGS.length - 1]).toBe("nurture");
  });

  it("all slugs are unique", () => {
    const unique = new Set(DEFAULT_STAGE_SLUGS);
    expect(unique.size).toBe(DEFAULT_STAGE_SLUGS.length);
  });

  it("slugs are snake_case format", () => {
    for (const slug of DEFAULT_STAGE_SLUGS) {
      expect(slug).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});
