import { describe, expect, it } from "vitest";

import {
  buildRoutingConfigFromRows,
  sanitizeZipCoverage,
  type RoutingRuleRow,
} from "@/lib/leadAssignment/routingRules";

function row(overrides: Partial<RoutingRuleRow> = {}): RoutingRuleRow {
  return {
    agentId: "a",
    inRoundRobin: true,
    zipCoverage: [],
    priority: 0,
    ...overrides,
  };
}

describe("buildRoutingConfigFromRows — allowlist", () => {
  it("returns empty allowlist when no rows", () => {
    expect(buildRoutingConfigFromRows([])).toEqual({
      allowlist: [],
      coverage: new Map(),
    });
  });

  it("excludes rows where in_round_robin is false", () => {
    const cfg = buildRoutingConfigFromRows([
      row({ agentId: "a", inRoundRobin: true }),
      row({ agentId: "b", inRoundRobin: false }),
      row({ agentId: "c", inRoundRobin: true }),
    ]);
    expect(cfg.allowlist).toEqual(["a", "c"]);
  });

  it("dedupes if the same agent appears twice (defensive)", () => {
    const cfg = buildRoutingConfigFromRows([
      row({ agentId: "a", inRoundRobin: true }),
      row({ agentId: "a", inRoundRobin: true }),
    ]);
    expect(cfg.allowlist).toEqual(["a"]);
  });

  it("trims whitespace from agent ids", () => {
    const cfg = buildRoutingConfigFromRows([
      row({ agentId: "  a  ", inRoundRobin: true }),
      row({ agentId: "b", inRoundRobin: true }),
    ]);
    expect(cfg.allowlist).toEqual(["a", "b"]);
  });

  it("drops rows with empty/blank agent ids", () => {
    const cfg = buildRoutingConfigFromRows([
      row({ agentId: "", inRoundRobin: true }),
      row({ agentId: "   ", inRoundRobin: true }),
      row({ agentId: "real", inRoundRobin: true }),
    ]);
    expect(cfg.allowlist).toEqual(["real"]);
  });
});

describe("buildRoutingConfigFromRows — sort order", () => {
  it("sorts by agentId asc when priorities tie (default 0)", () => {
    const cfg = buildRoutingConfigFromRows([
      row({ agentId: "z" }),
      row({ agentId: "a" }),
      row({ agentId: "m" }),
    ]);
    expect(cfg.allowlist).toEqual(["a", "m", "z"]);
  });

  it("sorts by priority desc, then agentId asc", () => {
    const cfg = buildRoutingConfigFromRows([
      row({ agentId: "low_z", priority: 0 }),
      row({ agentId: "high_a", priority: 10 }),
      row({ agentId: "low_a", priority: 0 }),
      row({ agentId: "high_b", priority: 10 }),
    ]);
    expect(cfg.allowlist).toEqual(["high_a", "high_b", "low_a", "low_z"]);
  });
});

describe("buildRoutingConfigFromRows — coverage map", () => {
  it("empty zip arrays produce no coverage entry (means 'any ZIP')", () => {
    const cfg = buildRoutingConfigFromRows([row({ agentId: "a", zipCoverage: [] })]);
    expect(cfg.coverage.has("a")).toBe(false);
  });

  it("populates the coverage map for agents with explicit ZIPs", () => {
    const cfg = buildRoutingConfigFromRows([
      row({ agentId: "a", zipCoverage: ["94087", "94088"] }),
    ]);
    expect(cfg.coverage.get("a")).toEqual(new Set(["94087", "94088"]));
  });

  it("drops malformed ZIPs, keeps the rest", () => {
    const cfg = buildRoutingConfigFromRows([
      row({ agentId: "a", zipCoverage: ["94087", "abc", "1234", "94088-1234", "94088"] }),
    ]);
    // "abc" → bad, "1234" → 4 digits, "94088-1234" → has dash
    expect(cfg.coverage.get("a")).toEqual(new Set(["94087", "94088"]));
  });

  it("does not add coverage for agents not in the allowlist (in_round_robin=false)", () => {
    const cfg = buildRoutingConfigFromRows([
      row({ agentId: "a", inRoundRobin: false, zipCoverage: ["94087"] }),
    ]);
    expect(cfg.coverage.has("a")).toBe(false);
  });
});

describe("sanitizeZipCoverage", () => {
  it("returns empty for null/undefined/blank", () => {
    expect(sanitizeZipCoverage(null)).toEqual([]);
    expect(sanitizeZipCoverage(undefined)).toEqual([]);
    expect(sanitizeZipCoverage("")).toEqual([]);
    expect(sanitizeZipCoverage("   ")).toEqual([]);
  });

  it("splits on commas + whitespace", () => {
    expect(sanitizeZipCoverage("94087, 94088 94089")).toEqual(["94087", "94088", "94089"]);
    expect(sanitizeZipCoverage("94087,94088,94089")).toEqual(["94087", "94088", "94089"]);
    expect(sanitizeZipCoverage("94087\n94088\n94089")).toEqual(["94087", "94088", "94089"]);
  });

  it("dedupes and sorts", () => {
    expect(sanitizeZipCoverage("94089, 94087, 94088, 94087")).toEqual([
      "94087",
      "94088",
      "94089",
    ]);
  });

  it("drops malformed values silently", () => {
    expect(sanitizeZipCoverage("94087, abc, 1234, 94088, 94088-1234")).toEqual([
      "94087",
      "94088",
    ]);
  });

  it("accepts arrays directly (UI may already split)", () => {
    expect(sanitizeZipCoverage(["94087", "94088", "abc", "94087"])).toEqual([
      "94087",
      "94088",
    ]);
  });
});
