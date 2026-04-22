import { describe, expect, it } from "vitest";
import { addDaysIso, applyDeadlineDefaults, CA_BUYER_REP_DEFAULT_OFFSETS } from "../deadlineDefaults";

describe("addDaysIso", () => {
  it("adds 17 days to a date without DST weirdness", () => {
    expect(addDaysIso("2026-03-10", 17)).toBe("2026-03-27");
  });

  it("crosses month boundaries correctly", () => {
    expect(addDaysIso("2026-01-25", 10)).toBe("2026-02-04");
  });

  it("crosses year boundaries", () => {
    expect(addDaysIso("2026-12-20", 15)).toBe("2027-01-04");
  });

  it("matches the named offsets (regression guard)", () => {
    expect(addDaysIso("2026-04-01", CA_BUYER_REP_DEFAULT_OFFSETS.inspection_deadline)).toBe("2026-04-18");
    expect(addDaysIso("2026-04-01", CA_BUYER_REP_DEFAULT_OFFSETS.loan_contingency_deadline)).toBe("2026-04-22");
    expect(addDaysIso("2026-04-01", CA_BUYER_REP_DEFAULT_OFFSETS.closing_date)).toBe("2026-05-01");
  });
});

describe("applyDeadlineDefaults", () => {
  it("returns empty patch when mutual_acceptance_date is null", () => {
    const patch = applyDeadlineDefaults({
      mutual_acceptance_date: null,
      inspection_deadline: null,
      appraisal_deadline: null,
      loan_contingency_deadline: null,
      closing_date: null,
    });
    expect(patch).toEqual({});
  });

  it("fills all four deadlines when they're all null", () => {
    const patch = applyDeadlineDefaults({
      mutual_acceptance_date: "2026-04-01",
      inspection_deadline: null,
      appraisal_deadline: null,
      loan_contingency_deadline: null,
      closing_date: null,
    });
    expect(patch).toEqual({
      inspection_deadline: "2026-04-18",
      appraisal_deadline: "2026-04-18",
      loan_contingency_deadline: "2026-04-22",
      closing_date: "2026-05-01",
    });
  });

  it("preserves any deadline the agent has already set", () => {
    const patch = applyDeadlineDefaults({
      mutual_acceptance_date: "2026-04-01",
      inspection_deadline: "2026-04-14", // agent negotiated shorter
      appraisal_deadline: null,
      loan_contingency_deadline: "2026-04-30", // agent negotiated longer
      closing_date: null,
    });
    expect(patch).toEqual({
      appraisal_deadline: "2026-04-18",
      closing_date: "2026-05-01",
    });
    // Critically: `inspection_deadline` and `loan_contingency_deadline`
    // are NOT in the patch — non-NULL values are sacred.
    expect(patch).not.toHaveProperty("inspection_deadline");
    expect(patch).not.toHaveProperty("loan_contingency_deadline");
  });
});
