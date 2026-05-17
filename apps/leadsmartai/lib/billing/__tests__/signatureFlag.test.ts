import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isSignatureTierAllowedServer } from "../signatureFlag";

describe("isSignatureTierAllowedServer", () => {
  let prev: string | undefined;
  beforeEach(() => {
    prev = process.env.NEXT_PUBLIC_FEATURE_SIGNATURE_TIER;
    delete process.env.NEXT_PUBLIC_FEATURE_SIGNATURE_TIER;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_FEATURE_SIGNATURE_TIER;
    else process.env.NEXT_PUBLIC_FEATURE_SIGNATURE_TIER = prev;
  });

  it("returns false when flag off + no cookie", () => {
    expect(isSignatureTierAllowedServer(null)).toBe(false);
    expect(isSignatureTierAllowedServer("")).toBe(false);
    expect(isSignatureTierAllowedServer("some_other=1")).toBe(false);
  });

  it("returns true when flag is on regardless of cookies", () => {
    process.env.NEXT_PUBLIC_FEATURE_SIGNATURE_TIER = "true";
    expect(isSignatureTierAllowedServer(null)).toBe(true);
    expect(isSignatureTierAllowedServer("")).toBe(true);
  });

  it("'TRUE' (mixed case) counts as enabled — env flag is normalized lowercase", () => {
    process.env.NEXT_PUBLIC_FEATURE_SIGNATURE_TIER = "TRUE";
    expect(isSignatureTierAllowedServer(null)).toBe(true);
  });

  it("'false' / '0' / empty are NOT enabled", () => {
    process.env.NEXT_PUBLIC_FEATURE_SIGNATURE_TIER = "false";
    expect(isSignatureTierAllowedServer(null)).toBe(false);
    process.env.NEXT_PUBLIC_FEATURE_SIGNATURE_TIER = "0";
    expect(isSignatureTierAllowedServer(null)).toBe(false);
    process.env.NEXT_PUBLIC_FEATURE_SIGNATURE_TIER = "";
    expect(isSignatureTierAllowedServer(null)).toBe(false);
  });

  it("preview cookie unlocks Signature when flag is off", () => {
    expect(isSignatureTierAllowedServer("lsai_sig_preview=1")).toBe(true);
    expect(isSignatureTierAllowedServer("foo=bar; lsai_sig_preview=1; baz=qux")).toBe(true);
  });

  it("preview cookie must be exactly '=1' to unlock (no partial matches)", () => {
    expect(isSignatureTierAllowedServer("lsai_sig_preview=0")).toBe(false);
    expect(isSignatureTierAllowedServer("lsai_sig_preview=true")).toBe(false);
    expect(isSignatureTierAllowedServer("lsai_sig_preview_x=1")).toBe(false);
    expect(isSignatureTierAllowedServer("xlsai_sig_preview=1")).toBe(false);
  });

  it("handles whitespace around cookie pairs", () => {
    expect(isSignatureTierAllowedServer("  foo=bar  ;  lsai_sig_preview=1  ")).toBe(true);
  });
});
