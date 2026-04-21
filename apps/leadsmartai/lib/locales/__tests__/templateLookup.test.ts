import { describe, expect, it } from "vitest";
import {
  pickTemplateForLocale,
  pickTemplatesForLocale,
  type TemplateRow,
} from "../templateLookup";

const parent: TemplateRow = {
  id: "first_response",
  variant_of: null,
  language: "en",
  body: "Hi there — thanks for reaching out.",
};

const zhVariant: TemplateRow = {
  id: "first_response__zh",
  variant_of: "first_response",
  language: "zh",
  body: "您好，感谢您的咨询。",
};

describe("pickTemplateForLocale", () => {
  it("returns the exact-locale variant when present", () => {
    expect(pickTemplateForLocale([parent, zhVariant], "zh")).toBe(zhVariant);
  });

  it("returns the English parent when requested locale has no variant", () => {
    expect(pickTemplateForLocale([parent], "zh")).toBe(parent);
  });

  it("returns the parent when requested locale is English and a zh variant also exists", () => {
    expect(pickTemplateForLocale([parent, zhVariant], "en")).toBe(parent);
  });

  it("returns null for an empty rowset", () => {
    expect(pickTemplateForLocale([], "zh")).toBeNull();
  });

  it("gracefully handles degenerate data with no parent row", () => {
    const orphan: TemplateRow = {
      id: "zh_only",
      variant_of: "missing",
      language: "zh",
      body: "…",
    };
    expect(pickTemplateForLocale([orphan], "en")).toBe(orphan);
  });
});

describe("pickTemplatesForLocale", () => {
  it("collapses multiple roots to one row per root", () => {
    const otherParent: TemplateRow = {
      id: "appointment_reminder",
      variant_of: null,
      language: "en",
      body: "Reminder: you're booked…",
    };
    const otherZh: TemplateRow = {
      id: "appointment_reminder__zh",
      variant_of: "appointment_reminder",
      language: "zh",
      body: "提醒：您的预约…",
    };
    const picked = pickTemplatesForLocale(
      [parent, zhVariant, otherParent, otherZh],
      "zh",
    );
    expect(picked).toHaveLength(2);
    expect(picked).toEqual(expect.arrayContaining([zhVariant, otherZh]));
  });

  it("returns English fallbacks for roots without the requested variant", () => {
    const noZh: TemplateRow = {
      id: "tour_followup",
      variant_of: null,
      language: "en",
      body: "How was the tour?",
    };
    const picked = pickTemplatesForLocale([parent, zhVariant, noZh], "zh");
    expect(picked).toHaveLength(2);
    const ids = picked.map((p) => p.id);
    expect(ids).toContain("first_response__zh");
    expect(ids).toContain("tour_followup");
  });
});
