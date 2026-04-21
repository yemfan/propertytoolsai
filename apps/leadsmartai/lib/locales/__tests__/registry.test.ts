import { describe, expect, it } from "vitest";
import {
  coerceLocale,
  DEFAULT_LOCALE,
  getLocale,
  isSupportedLocale,
  listOutboundEnabled,
  listUiEnabled,
  LOCALE_REGISTRY,
} from "../registry";

describe("registry invariants", () => {
  it("every entry's bcp47 starts with its base id", () => {
    for (const [id, entry] of Object.entries(LOCALE_REGISTRY)) {
      expect(entry.id).toBe(id);
      expect(entry.bcp47.toLowerCase().startsWith(id.toLowerCase())).toBe(true);
    }
  });

  it("every outbound-enabled entry has a non-empty tone directive", () => {
    for (const entry of listOutboundEnabled()) {
      expect(entry.outboundToneDirective.trim().length).toBeGreaterThan(20);
    }
  });

  it("every entry ships non-empty SMS consent copy with a version tag", () => {
    for (const entry of Object.values(LOCALE_REGISTRY)) {
      expect(entry.smsConsentCopy.text.trim().length).toBeGreaterThan(20);
      expect(entry.smsConsentCopy.version.trim().length).toBeGreaterThan(0);
    }
  });

  it("English is always outbound- and ui-enabled (canonical fallback)", () => {
    expect(getLocale("en").outbound.enabled).toBe(true);
    expect(getLocale("en").ui.enabled).toBe(true);
  });
});

describe("isSupportedLocale + coerceLocale", () => {
  it("accepts known locales", () => {
    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("zh")).toBe(true);
  });

  it("rejects unknown + non-string inputs", () => {
    expect(isSupportedLocale("klingon")).toBe(false);
    expect(isSupportedLocale(null)).toBe(false);
    expect(isSupportedLocale(undefined)).toBe(false);
    expect(isSupportedLocale(42)).toBe(false);
  });

  it("coerceLocale falls back to the default locale for invalid inputs", () => {
    expect(coerceLocale(null)).toBe(DEFAULT_LOCALE);
    expect(coerceLocale("klingon")).toBe(DEFAULT_LOCALE);
    expect(coerceLocale("zh")).toBe("zh");
  });
});

describe("listUiEnabled", () => {
  it("currently only includes English — zh.ui.enabled flips to true with the catalog-coverage PR", () => {
    const ids = listUiEnabled().map((l) => l.id);
    expect(ids).toEqual(["en"]);
  });
});
