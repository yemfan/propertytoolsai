import { describe, expect, it } from "vitest";

import { resolveDraftStatusForDrip } from "@/lib/sphereDrip/draftStatus";

describe("resolveDraftStatusForDrip", () => {
  it("review policy → pending", () => {
    expect(
      resolveDraftStatusForDrip({ reviewPolicy: "review", sphereCategory: null }),
    ).toBe("pending");
  });

  it("autosend policy → approved", () => {
    expect(
      resolveDraftStatusForDrip({ reviewPolicy: "autosend", sphereCategory: null }),
    ).toBe("approved");
  });

  it("autosend ignores stale per-category setting (only honored under per_category)", () => {
    // Even with sphereCategory='review' present, autosend wins because the
    // policy isn't per_category.
    expect(
      resolveDraftStatusForDrip({ reviewPolicy: "autosend", sphereCategory: "review" }),
    ).toBe("approved");
  });

  it("per_category + sphereCategory='autosend' → approved", () => {
    expect(
      resolveDraftStatusForDrip({
        reviewPolicy: "per_category",
        sphereCategory: "autosend",
      }),
    ).toBe("approved");
  });

  it("per_category + sphereCategory='review' → pending", () => {
    expect(
      resolveDraftStatusForDrip({
        reviewPolicy: "per_category",
        sphereCategory: "review",
      }),
    ).toBe("pending");
  });

  it("per_category + missing sphereCategory → pending (cautious default)", () => {
    expect(
      resolveDraftStatusForDrip({
        reviewPolicy: "per_category",
        sphereCategory: null,
      }),
    ).toBe("pending");
  });
});
