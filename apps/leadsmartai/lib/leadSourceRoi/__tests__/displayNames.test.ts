import { describe, expect, it } from "vitest";

import {
  bucketKeyFor,
  labelForSourceKey,
  sourceKeySortIndex,
} from "@/lib/leadSourceRoi/displayNames";

describe("bucketKeyFor", () => {
  it("buckets null/undefined/empty/whitespace into __unknown__", () => {
    expect(bucketKeyFor(null)).toBe("__unknown__");
    expect(bucketKeyFor(undefined)).toBe("__unknown__");
    expect(bucketKeyFor("")).toBe("__unknown__");
    expect(bucketKeyFor("   ")).toBe("__unknown__");
  });

  it("trims and lowercases", () => {
    expect(bucketKeyFor("  IDX_HOMES_FOR_SALE ")).toBe("idx_homes_for_sale");
    expect(bucketKeyFor("Voice_AI_Demo")).toBe("voice_ai_demo");
  });

  it("preserves the canonical key for known sources", () => {
    expect(bucketKeyFor("idx_homes_for_sale")).toBe("idx_homes_for_sale");
  });
});

describe("labelForSourceKey", () => {
  it("returns the curated label for known keys", () => {
    expect(labelForSourceKey("idx_homes_for_sale")).toBe("IDX home search");
    expect(labelForSourceKey("voice_ai_demo")).toBe("Voice AI demo (agent prospect)");
    expect(labelForSourceKey("__unknown__")).toBe("Unknown / unattributed");
  });

  it("title-cases unmapped keys via humanizeSource fallback", () => {
    expect(labelForSourceKey("facebook_lead_form")).toBe("Facebook lead form");
    expect(labelForSourceKey("google-ads-campaign")).toBe("Google ads campaign");
  });

  it("normalizes ALLCAPS in unmapped keys", () => {
    expect(labelForSourceKey("FACEBOOK_LEADS")).toBe("Facebook leads");
  });

  it("falls back to the unknown bucket label for empty strings", () => {
    expect(labelForSourceKey("")).toBe("Unknown / unattributed");
  });
});

describe("sourceKeySortIndex", () => {
  it("sorts __unknown__ to the end", () => {
    const knownIdx = sourceKeySortIndex("idx_homes_for_sale");
    const unknownIdx = sourceKeySortIndex("__unknown__");
    expect(unknownIdx).toBeGreaterThan(knownIdx);
  });

  it("preserves the curated mapping order for known sources", () => {
    expect(sourceKeySortIndex("idx_homes_for_sale")).toBeLessThan(
      sourceKeySortIndex("voice_ai_demo"),
    );
    expect(sourceKeySortIndex("voice_ai_demo")).toBeLessThan(
      sourceKeySortIndex("home_value"),
    );
  });

  it("places unknown-but-not-empty sources after known but before __unknown__", () => {
    const known = sourceKeySortIndex("idx_homes_for_sale");
    const novel = sourceKeySortIndex("brand_new_source");
    const unknown = sourceKeySortIndex("__unknown__");
    expect(novel).toBeGreaterThan(known);
    expect(novel).toBeLessThan(unknown);
  });
});
