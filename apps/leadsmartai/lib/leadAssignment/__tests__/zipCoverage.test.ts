import { describe, expect, it } from "vitest";

import {
  extractZipFromAddress,
  filterAgentsByZip,
  parseAgentZipCoverage,
} from "@/lib/leadAssignment/zipCoverage";

describe("parseAgentZipCoverage", () => {
  it("returns empty map for null/undefined/empty/whitespace", () => {
    expect(parseAgentZipCoverage(null).size).toBe(0);
    expect(parseAgentZipCoverage(undefined).size).toBe(0);
    expect(parseAgentZipCoverage("").size).toBe(0);
    expect(parseAgentZipCoverage("   ").size).toBe(0);
  });

  it("returns empty map for malformed JSON (never throws)", () => {
    expect(parseAgentZipCoverage("{not json").size).toBe(0);
    expect(parseAgentZipCoverage("not even close").size).toBe(0);
  });

  it("returns empty map when JSON is an array (not an object)", () => {
    expect(parseAgentZipCoverage('["a","b"]').size).toBe(0);
  });

  it("parses a simple two-agent coverage map", () => {
    const m = parseAgentZipCoverage('{"a":["94087","94088"],"b":["78701"]}');
    expect(m.size).toBe(2);
    expect(Array.from(m.get("a") ?? [])).toEqual(["94087", "94088"]);
    expect(Array.from(m.get("b") ?? [])).toEqual(["78701"]);
  });

  it("drops non-string and malformed-length zip entries silently", () => {
    const m = parseAgentZipCoverage(
      '{"a":["94087",94088,"abc","123","123456","12345"]}',
    );
    expect(Array.from(m.get("a") ?? [])).toEqual(["94087", "12345"]);
  });

  it("drops agents with no valid zips after filtering", () => {
    const m = parseAgentZipCoverage('{"a":["abc","12"],"b":["78701"]}');
    expect(m.has("a")).toBe(false);
    expect(m.has("b")).toBe(true);
  });

  it("trims whitespace on agent ids and zips", () => {
    const m = parseAgentZipCoverage('{" a ":[" 94087 "]}');
    expect(m.has("a")).toBe(true);
    expect(m.get("a")?.has("94087")).toBe(true);
  });

  it("ignores agents whose value is not an array", () => {
    const m = parseAgentZipCoverage('{"a":"94087","b":["78701"]}');
    expect(m.has("a")).toBe(false);
    expect(m.has("b")).toBe(true);
  });
});

describe("filterAgentsByZip", () => {
  const coverage = parseAgentZipCoverage(
    '{"a":["94087","94088"],"b":["78701"],"c":["94087","78701"]}',
  );

  it("returns empty when eligible list is empty", () => {
    expect(filterAgentsByZip([], "94087", coverage)).toEqual([]);
  });

  it("returns the original list when no zip is provided", () => {
    expect(filterAgentsByZip(["a", "b"], null, coverage)).toEqual(["a", "b"]);
    expect(filterAgentsByZip(["a", "b"], undefined, coverage)).toEqual(["a", "b"]);
    expect(filterAgentsByZip(["a", "b"], "", coverage)).toEqual(["a", "b"]);
  });

  it("returns the original list when coverage map is empty", () => {
    expect(filterAgentsByZip(["a", "b"], "94087", new Map())).toEqual(["a", "b"]);
  });

  it("returns the original list when zip is malformed (not 5 digits)", () => {
    expect(filterAgentsByZip(["a", "b"], "abc", coverage)).toEqual(["a", "b"]);
    expect(filterAgentsByZip(["a", "b"], "123", coverage)).toEqual(["a", "b"]);
    expect(filterAgentsByZip(["a", "b"], "1234567", coverage)).toEqual(["a", "b"]);
  });

  it("narrows to agents whose coverage includes the zip", () => {
    expect(filterAgentsByZip(["a", "b", "c"], "94087", coverage)).toEqual(["a", "c"]);
    expect(filterAgentsByZip(["a", "b", "c"], "78701", coverage)).toEqual(["b", "c"]);
  });

  it("preserves the input ordering of the eligible list", () => {
    expect(filterAgentsByZip(["c", "a", "b"], "94087", coverage)).toEqual(["c", "a"]);
  });

  it("falls back to the full list when NO listed agent covers the zip (don't drop the lead)", () => {
    expect(filterAgentsByZip(["a", "b"], "10001", coverage)).toEqual(["a", "b"]);
  });

  it("trims whitespace on the input zip", () => {
    expect(filterAgentsByZip(["a", "b"], "  94087  ", coverage)).toEqual(["a"]);
  });

  it("ignores agents in the eligible list with no coverage entry", () => {
    // 'd' isn't in coverage at all — only 'c' covers 94087+78701 so it's the only match.
    expect(filterAgentsByZip(["a", "d", "c"], "78701", coverage)).toEqual(["c"]);
  });
});

describe("extractZipFromAddress", () => {
  it("returns null for null/undefined/empty", () => {
    expect(extractZipFromAddress(null)).toBeNull();
    expect(extractZipFromAddress(undefined)).toBeNull();
    expect(extractZipFromAddress("")).toBeNull();
  });

  it("extracts a trailing 5-digit ZIP from a typical US address", () => {
    expect(extractZipFromAddress("1234 Elm St, Austin, TX 78701")).toBe("78701");
    expect(extractZipFromAddress("1 Maple Ave, Sunnyvale, CA 94087")).toBe("94087");
  });

  it("ignores leading 5-digit street numbers ('12345 Elm St' is NOT a ZIP)", () => {
    // The reversed-search trick avoids picking up a street number.
    expect(extractZipFromAddress("12345 Elm St, Austin, TX 78701")).toBe("78701");
  });

  it("strips the ZIP+4 suffix and returns just the 5-digit prefix", () => {
    expect(extractZipFromAddress("1 Maple Ave, Austin, TX 78701-1234")).toBe("78701");
  });

  it("returns null when no 5-digit run is present", () => {
    expect(extractZipFromAddress("just some text, no numbers")).toBeNull();
    expect(extractZipFromAddress("Apt 12B")).toBeNull();
  });
});
