import { describe, it, expect } from "vitest";
import { parseEligibility } from "./stedi";

describe("parseEligibility", () => {
  it("flattens an active-coverage 271 into front-desk fields", () => {
    const resp = {
      benefitsInformation: [
        { code: "1", name: "Active Coverage", serviceTypeCodes: ["30"] },
        { code: "B", benefitAmount: "30", serviceTypeCodes: ["30"] }, // copay
        { code: "A", benefitPercent: "0.2" }, // coinsurance 20%
        { code: "C", benefitAmount: "1500", timeQualifierCode: "23" }, // deductible total
        { code: "C", benefitAmount: "750", timeQualifierCode: "29" }, // deductible remaining
      ],
    };
    const r = parseEligibility(resp);
    expect(r.status).toBe("active");
    expect(r.planName).toBe("Active Coverage");
    expect(r.copay).toBe(30);
    expect(r.coinsurance).toBe(20);
    expect(r.deductible).toBe(1500);
    expect(r.deductibleRemaining).toBe(750);
    expect(r.error).toBeNull();
  });

  it("reports inactive coverage from code 6", () => {
    const r = parseEligibility({ benefitsInformation: [{ code: "6", name: "Inactive" }] });
    expect(r.status).toBe("inactive");
  });

  it("treats an empty/garbage payload as inactive, not a crash", () => {
    expect(parseEligibility({}).status).toBe("inactive");
    expect(parseEligibility(null).status).toBe("inactive");
    expect(parseEligibility({ benefitsInformation: "nope" }).status).toBe("inactive");
  });

  it("surfaces a payer AAA error instead of silently reporting inactive", () => {
    // Shape confirmed against the live Stedi sandbox (AHS test payer, member-not-found).
    const r = parseEligibility({
      errors: [{ code: "79", description: "Invalid Participant Identification" }],
    });
    expect(r.status).toBe("error");
    expect(r.error).toContain("Invalid Participant");
  });
});
