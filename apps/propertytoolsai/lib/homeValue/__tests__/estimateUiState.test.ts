import { describe, expect, it } from "vitest";
import { deriveEstimateUiState, isReportGateVisible } from "../estimateUiState";

describe("deriveEstimateUiState", () => {
  const base = {
    addressTrimmed: "",
    hasStructuredPlace: false,
    loading: false,
    refinePending: false,
    hasEstimate: false,
    userRefined: false,
    reportUnlocked: false,
    leadModalOpen: false,
  };

  it("idle when empty", () => {
    expect(deriveEstimateUiState(base)).toBe("idle");
  });

  it("address_selected with text", () => {
    expect(deriveEstimateUiState({ ...base, addressTrimmed: "123 Main St, Pasadena CA" })).toBe(
      "address_selected"
    );
  });

  it("estimating", () => {
    expect(deriveEstimateUiState({ ...base, addressTrimmed: "x", loading: true })).toBe("estimating");
  });

  it("preview_ready vs refined_result_ready", () => {
    expect(
      deriveEstimateUiState({
        ...base,
        addressTrimmed: "x",
        hasEstimate: true,
        userRefined: false,
      })
    ).toBe("preview_ready");
    expect(
      deriveEstimateUiState({
        ...base,
        addressTrimmed: "x",
        hasEstimate: true,
        userRefined: true,
      })
    ).toBe("refined_result_ready");
  });

  it("unlocking when modal open", () => {
    expect(
      deriveEstimateUiState({
        ...base,
        hasEstimate: true,
        leadModalOpen: true,
      })
    ).toBe("unlocking");
  });

  it("next_steps when unlocked with recommendations", () => {
    expect(
      deriveEstimateUiState({
        ...base,
        hasEstimate: true,
        reportUnlocked: true,
        hasRecommendations: true,
      })
    ).toBe("next_steps");
    expect(
      deriveEstimateUiState({
        ...base,
        hasEstimate: true,
        reportUnlocked: true,
        hasRecommendations: false,
      })
    ).toBe("report_unlocked");
  });
});

describe("isReportGateVisible", () => {
  it("true for preview, refined_result_ready, unlocking", () => {
    expect(isReportGateVisible("preview_ready")).toBe(true);
    expect(isReportGateVisible("refined_result_ready")).toBe(true);
    expect(isReportGateVisible("unlocking")).toBe(true);
    expect(isReportGateVisible("idle")).toBe(false);
  });
});
