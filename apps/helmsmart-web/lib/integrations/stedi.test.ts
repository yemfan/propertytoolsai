import { describe, it, expect, afterEach } from "vitest";
import { parseEligibility, checkEligibility } from "./stedi";

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

describe("checkEligibility HIPAA gate", () => {
  const origKey = process.env.STEDI_API_KEY;
  const origFlag = process.env.DOCTORSMART_HIPAA_READY;
  afterEach(() => {
    if (origKey === undefined) delete process.env.STEDI_API_KEY;
    else process.env.STEDI_API_KEY = origKey;
    if (origFlag === undefined) delete process.env.DOCTORSMART_HIPAA_READY;
    else process.env.DOCTORSMART_HIPAA_READY = origFlag;
  });

  const input = {
    npi: "1234567890",
    organizationName: "Clinic",
    payerId: "AHS",
    firstName: "A",
    lastName: "B",
    dateOfBirth: "2000-01-01",
    memberId: "M1",
  };

  it("returns the mock (no network) when no key is set", async () => {
    delete process.env.STEDI_API_KEY;
    const r = await checkEligibility(input);
    expect(r.status).toBe("active");
    expect((r.raw as { mock?: boolean } | null)?.mock).toBe(true);
  });

  it("blocks a LIVE key until DOCTORSMART_HIPAA_READY=true — no PHI leaves", async () => {
    process.env.STEDI_API_KEY = "live_shouldNotTransmit";
    delete process.env.DOCTORSMART_HIPAA_READY;
    const r = await checkEligibility(input);
    expect(r.status).toBe("error");
    expect(r.error).toContain("HIPAA");
  });
});
