import { describe, expect, it } from "vitest";

import {
  buildLeadRoutingRoster,
  buildZipCoverageMap,
  type BuildRosterInput,
} from "@/lib/leadAssignment/adminRoster";

function input(overrides: Partial<BuildRosterInput> = {}): BuildRosterInput {
  return {
    rules: [],
    envAllowlist: [],
    envZipCoverage: new Map(),
    agentMeta: [],
    assignments: [],
    ...overrides,
  };
}

describe("buildLeadRoutingRoster — DB-only", () => {
  it("returns empty roster for empty inputs", () => {
    expect(buildLeadRoutingRoster(input())).toEqual([]);
  });

  it("emits a row per DB rule with source='db' when no env overlap", () => {
    const out = buildLeadRoutingRoster(
      input({
        rules: [
          {
            agentId: "a",
            inRoundRobin: true,
            zipCoverage: ["94087"],
            priority: 0,
            rulesUpdatedAt: "2026-04-20T00:00:00Z",
          },
        ],
        agentMeta: [{ agentId: "a", displayName: "Agent A" }],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("db");
    expect(out[0].displayName).toBe("Agent A");
  });

  it("preserves in_round_robin=false (so admin sees agents who opted out)", () => {
    const out = buildLeadRoutingRoster(
      input({
        rules: [
          {
            agentId: "a",
            inRoundRobin: false,
            zipCoverage: [],
            priority: 0,
            rulesUpdatedAt: null,
          },
        ],
      }),
    );
    expect(out[0].inRoundRobin).toBe(false);
  });

  it("dedupes + sorts ZIP coverage from a DB rule", () => {
    const out = buildLeadRoutingRoster(
      input({
        rules: [
          {
            agentId: "a",
            inRoundRobin: true,
            zipCoverage: ["94089", "94087", "94087", "94088"],
            priority: 0,
            rulesUpdatedAt: null,
          },
        ],
      }),
    );
    expect(out[0].zipCoverage).toEqual(["94087", "94088", "94089"]);
  });
});

describe("buildLeadRoutingRoster — env-only", () => {
  it("emits a row per env agent with source='env' when no DB row", () => {
    const out = buildLeadRoutingRoster(
      input({
        envAllowlist: ["e1", "e2"],
        envZipCoverage: new Map([["e1", ["78701", "78702"]]]),
        agentMeta: [
          { agentId: "e1", displayName: "Env One" },
          { agentId: "e2", displayName: "Env Two" },
        ],
      }),
    );
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.source === "env")).toBe(true);
    const e1 = out.find((r) => r.agentId === "e1")!;
    expect(e1.zipCoverage).toEqual(["78701", "78702"]);
    expect(e1.inRoundRobin).toBe(true);
  });

  it("env agent without metadata still appears with displayName=null", () => {
    const out = buildLeadRoutingRoster(
      input({
        envAllowlist: ["unknown"],
      }),
    );
    expect(out[0].displayName).toBeNull();
  });
});

describe("buildLeadRoutingRoster — overlap (DB + env)", () => {
  it("agent in BOTH sources shows source='both' and DB rule wins", () => {
    const out = buildLeadRoutingRoster(
      input({
        rules: [
          {
            agentId: "a",
            inRoundRobin: false, // DB says they opted out
            zipCoverage: ["94087"],
            priority: 5,
            rulesUpdatedAt: "2026-04-20T00:00:00Z",
          },
        ],
        envAllowlist: ["a"],
        envZipCoverage: new Map([["a", ["78701"]]]),
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("both");
    // DB-rule fields take precedence over env's
    expect(out[0].inRoundRobin).toBe(false);
    expect(out[0].zipCoverage).toEqual(["94087"]);
    expect(out[0].priority).toBe(5);
  });

  it("dedupes — same agent in DB + env produces ONE row, not two", () => {
    const out = buildLeadRoutingRoster(
      input({
        rules: [
          {
            agentId: "a",
            inRoundRobin: true,
            zipCoverage: [],
            priority: 0,
            rulesUpdatedAt: null,
          },
        ],
        envAllowlist: ["a"],
      }),
    );
    expect(out).toHaveLength(1);
  });
});

describe("buildLeadRoutingRoster — sort order", () => {
  it("activity desc bubbles busiest agents to the top", () => {
    const out = buildLeadRoutingRoster(
      input({
        rules: [
          { agentId: "low", inRoundRobin: true, zipCoverage: [], priority: 0, rulesUpdatedAt: null },
          { agentId: "hi", inRoundRobin: true, zipCoverage: [], priority: 0, rulesUpdatedAt: null },
          { agentId: "mid", inRoundRobin: true, zipCoverage: [], priority: 0, rulesUpdatedAt: null },
        ],
        assignments: [
          { agentId: "low", lastAssignmentAt: null, assignmentCountLast30Days: 1 },
          { agentId: "hi", lastAssignmentAt: null, assignmentCountLast30Days: 12 },
          { agentId: "mid", lastAssignmentAt: null, assignmentCountLast30Days: 5 },
        ],
      }),
    );
    expect(out.map((r) => r.agentId)).toEqual(["hi", "mid", "low"]);
  });

  it("ties on activity → most recent lastAssignmentAt wins (desc)", () => {
    const out = buildLeadRoutingRoster(
      input({
        rules: [
          { agentId: "older", inRoundRobin: true, zipCoverage: [], priority: 0, rulesUpdatedAt: null },
          { agentId: "newer", inRoundRobin: true, zipCoverage: [], priority: 0, rulesUpdatedAt: null },
        ],
        assignments: [
          {
            agentId: "older",
            lastAssignmentAt: "2026-04-10T00:00:00Z",
            assignmentCountLast30Days: 3,
          },
          {
            agentId: "newer",
            lastAssignmentAt: "2026-04-20T00:00:00Z",
            assignmentCountLast30Days: 3,
          },
        ],
      }),
    );
    expect(out.map((r) => r.agentId)).toEqual(["newer", "older"]);
  });

  it("further ties → display name asc, then id asc", () => {
    const out = buildLeadRoutingRoster(
      input({
        rules: [
          { agentId: "z-id", inRoundRobin: true, zipCoverage: [], priority: 0, rulesUpdatedAt: null },
          { agentId: "a-id", inRoundRobin: true, zipCoverage: [], priority: 0, rulesUpdatedAt: null },
        ],
        agentMeta: [
          { agentId: "z-id", displayName: "Adam" },
          { agentId: "a-id", displayName: "Brenda" },
        ],
      }),
    );
    // Adam < Brenda alphabetically, so z-id (Adam) sorts first.
    expect(out.map((r) => r.agentId)).toEqual(["z-id", "a-id"]);
  });
});

describe("buildZipCoverageMap", () => {
  it("returns empty map when no enrolled agents", () => {
    const out = buildZipCoverageMap([]);
    expect(out.size).toBe(0);
  });

  it("indexes ZIPs to agent ids, only for enrolled agents", () => {
    const roster = buildLeadRoutingRoster(
      input({
        rules: [
          { agentId: "a", inRoundRobin: true, zipCoverage: ["94087"], priority: 0, rulesUpdatedAt: null },
          { agentId: "b", inRoundRobin: true, zipCoverage: ["94087", "94088"], priority: 0, rulesUpdatedAt: null },
          { agentId: "c", inRoundRobin: false, zipCoverage: ["94089"], priority: 0, rulesUpdatedAt: null },
        ],
      }),
    );
    const zipMap = buildZipCoverageMap(roster);
    expect(zipMap.get("94087")).toEqual(["a", "b"]);
    expect(zipMap.get("94088")).toEqual(["b"]);
    expect(zipMap.has("94089")).toBe(false); // c is opted out
  });
});
