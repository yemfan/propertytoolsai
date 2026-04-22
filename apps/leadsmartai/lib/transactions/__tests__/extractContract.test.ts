import { describe, expect, it, vi } from "vitest";

// The module imports `server-only` + `@/lib/anthropic`. We only test the
// pure parser here, so stub both so the import chain doesn't fail.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/anthropic", () => ({
  getAnthropicClient: () => {
    throw new Error("should not be called in parser tests");
  },
}));

// eslint-disable-next-line import/first
import { parseExtractionResponse } from "../extractContract";

describe("parseExtractionResponse", () => {
  const fullJson = JSON.stringify({
    propertyAddress: "123 Main St",
    city: "San Francisco",
    state: "CA",
    zip: "94110",
    purchasePrice: 1_250_000,
    mutualAcceptanceDate: "2026-04-22",
    closingDate: "2026-05-22",
    buyerNames: ["Jane Buyer", "John Buyer"],
    sellerNames: ["Pat Seller"],
    contingencies: { inspectionDays: 17, appraisalDays: 17, loanDays: 21 },
    confidence: 0.92,
    warnings: [],
  });

  it("parses a clean JSON response", () => {
    const out = parseExtractionResponse(fullJson);
    expect(out.propertyAddress).toBe("123 Main St");
    expect(out.purchasePrice).toBe(1_250_000);
    expect(out.mutualAcceptanceDate).toBe("2026-04-22");
    expect(out.buyerNames).toEqual(["Jane Buyer", "John Buyer"]);
    expect(out.contingencies.loanDays).toBe(21);
    expect(out.confidence).toBe(0.92);
  });

  it("strips markdown fences Claude sometimes adds despite instructions", () => {
    const fenced = "```json\n" + fullJson + "\n```";
    const out = parseExtractionResponse(fenced);
    expect(out.propertyAddress).toBe("123 Main St");
  });

  it("accepts MM/DD/YYYY dates by normalizing to ISO", () => {
    const out = parseExtractionResponse(
      JSON.stringify({
        ...JSON.parse(fullJson),
        mutualAcceptanceDate: "4/22/2026",
        closingDate: "05/22/2026",
      }),
    );
    expect(out.mutualAcceptanceDate).toBe("2026-04-22");
    expect(out.closingDate).toBe("2026-05-22");
  });

  it("strips $ + commas from string-formatted prices", () => {
    const out = parseExtractionResponse(
      JSON.stringify({ ...JSON.parse(fullJson), purchasePrice: "$1,250,000" }),
    );
    expect(out.purchasePrice).toBe(1_250_000);
  });

  it("returns null for garbage date formats rather than guessing", () => {
    const out = parseExtractionResponse(
      JSON.stringify({ ...JSON.parse(fullJson), mutualAcceptanceDate: "April 22, 2026" }),
    );
    expect(out.mutualAcceptanceDate).toBeNull();
  });

  it("clamps confidence into 0..1", () => {
    const hi = parseExtractionResponse(
      JSON.stringify({ ...JSON.parse(fullJson), confidence: 1.7 }),
    );
    const lo = parseExtractionResponse(
      JSON.stringify({ ...JSON.parse(fullJson), confidence: -0.2 }),
    );
    const nn = parseExtractionResponse(
      JSON.stringify({ ...JSON.parse(fullJson), confidence: "not a number" }),
    );
    expect(hi.confidence).toBe(1);
    expect(lo.confidence).toBe(0);
    expect(nn.confidence).toBe(0);
  });

  it("keeps nulls for missing fields instead of hallucinating defaults", () => {
    const out = parseExtractionResponse(
      JSON.stringify({
        propertyAddress: null,
        city: null,
        purchasePrice: null,
        buyerNames: null,
        contingencies: null,
        confidence: 0.4,
      }),
    );
    expect(out.propertyAddress).toBeNull();
    expect(out.purchasePrice).toBeNull();
    expect(out.buyerNames).toEqual([]);
    expect(out.contingencies).toEqual({
      inspectionDays: null,
      appraisalDays: null,
      loanDays: null,
    });
  });

  it("throws a descriptive error on invalid JSON", () => {
    expect(() => parseExtractionResponse("not json at all")).toThrowError(
      /did not return valid JSON/i,
    );
  });
});
