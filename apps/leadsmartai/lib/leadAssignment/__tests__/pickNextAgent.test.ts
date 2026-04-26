import { describe, expect, it } from "vitest";

import {
  buildAssignmentMap,
  parseAgentAllowlist,
  pickNextAgent,
} from "@/lib/leadAssignment/pickNextAgent";

describe("pickNextAgent", () => {
  it("returns null for empty eligible list", () => {
    expect(pickNextAgent([], new Map())).toBeNull();
    expect(pickNextAgent([], new Map([["a", "2026-04-01T00:00:00Z"]]))).toBeNull();
  });

  it("returns the only agent when there is exactly one", () => {
    expect(pickNextAgent(["a"], new Map())).toBe("a");
    // Even if that agent has been assigned recently — still the only choice.
    expect(pickNextAgent(["a"], new Map([["a", "2026-04-26T00:00:00Z"]]))).toBe("a");
  });

  it("prefers never-assigned agents over recently-assigned ones", () => {
    const result = pickNextAgent(
      ["a", "b", "c"],
      new Map([
        ["a", "2026-04-01T00:00:00Z"],
        ["c", "2026-04-26T00:00:00Z"],
      ]),
    );
    expect(result).toBe("b");
  });

  it("when multiple never-assigned, picks lowest id (deterministic)", () => {
    const result = pickNextAgent(
      ["zzz", "aaa", "mmm"],
      new Map([["aaa", "2026-04-01T00:00:00Z"]]),
    );
    expect(result).toBe("mmm"); // mmm < zzz, both never-assigned
  });

  it("when all assigned, picks the oldest timestamp", () => {
    const result = pickNextAgent(
      ["a", "b", "c"],
      new Map([
        ["a", "2026-04-20T00:00:00Z"],
        ["b", "2026-04-10T00:00:00Z"],
        ["c", "2026-04-25T00:00:00Z"],
      ]),
    );
    expect(result).toBe("b");
  });

  it("breaks timestamp ties by id ascending", () => {
    const ts = "2026-04-15T00:00:00Z";
    const result = pickNextAgent(
      ["zzz", "aaa", "mmm"],
      new Map([
        ["zzz", ts],
        ["aaa", ts],
        ["mmm", ts],
      ]),
    );
    expect(result).toBe("aaa");
  });

  it("ignores assignment-map entries for agents not in the eligible list", () => {
    // 'a' is in the eligible list but the map says 'a' was assigned 5 days ago.
    // 'z' (not eligible) was assigned today — should not affect the pick.
    const result = pickNextAgent(
      ["a", "b"],
      new Map([
        ["a", "2026-04-21T00:00:00Z"],
        ["b", "2026-04-20T00:00:00Z"],
        ["z", "2026-04-26T00:00:00Z"],
      ]),
    );
    expect(result).toBe("b");
  });

  it("rotates correctly across consecutive picks (simulated round-robin)", () => {
    const eligible = ["a", "b", "c"];
    const map = new Map<string, string>();

    // Pick 1: all never-assigned → 'a' (alphabetically first)
    const p1 = pickNextAgent(eligible, map);
    expect(p1).toBe("a");
    map.set(p1!, "2026-04-26T10:00:00Z");

    // Pick 2: b and c never-assigned → 'b'
    const p2 = pickNextAgent(eligible, map);
    expect(p2).toBe("b");
    map.set(p2!, "2026-04-26T10:01:00Z");

    // Pick 3: c never-assigned → 'c'
    const p3 = pickNextAgent(eligible, map);
    expect(p3).toBe("c");
    map.set(p3!, "2026-04-26T10:02:00Z");

    // Pick 4: all assigned. 'a' has the oldest timestamp.
    const p4 = pickNextAgent(eligible, map);
    expect(p4).toBe("a");
  });
});

describe("parseAgentAllowlist", () => {
  it("returns empty array for null/undefined/empty", () => {
    expect(parseAgentAllowlist(null)).toEqual([]);
    expect(parseAgentAllowlist(undefined)).toEqual([]);
    expect(parseAgentAllowlist("")).toEqual([]);
  });

  it("parses a single id", () => {
    expect(parseAgentAllowlist("agent-1")).toEqual(["agent-1"]);
  });

  it("parses comma-separated ids and trims whitespace", () => {
    expect(parseAgentAllowlist("a, b , c")).toEqual(["a", "b", "c"]);
  });

  it("dedupes while preserving first-seen order", () => {
    expect(parseAgentAllowlist("a,b,a,c,b")).toEqual(["a", "b", "c"]);
  });

  it("ignores empty segments from stray commas", () => {
    expect(parseAgentAllowlist(",a,,b,")).toEqual(["a", "b"]);
  });
});

describe("buildAssignmentMap", () => {
  it("returns an empty map for empty rows", () => {
    expect(buildAssignmentMap([]).size).toBe(0);
  });

  it("skips rows with null lastAssignedAt", () => {
    const map = buildAssignmentMap([
      { agentId: "a", lastAssignedAt: "2026-04-26T00:00:00Z" },
      { agentId: "b", lastAssignedAt: null },
    ]);
    expect(map.has("a")).toBe(true);
    expect(map.has("b")).toBe(false);
  });

  it("when an agent appears twice, keeps the most recent timestamp", () => {
    const map = buildAssignmentMap([
      { agentId: "a", lastAssignedAt: "2026-04-20T00:00:00Z" },
      { agentId: "a", lastAssignedAt: "2026-04-25T00:00:00Z" },
      { agentId: "a", lastAssignedAt: "2026-04-22T00:00:00Z" },
    ]);
    expect(map.get("a")).toBe("2026-04-25T00:00:00Z");
  });
});
