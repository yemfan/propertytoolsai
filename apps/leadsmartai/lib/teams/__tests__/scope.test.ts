import { describe, expect, it } from "vitest";
import { buildAgentScope, soloScope } from "../scope";

describe("buildAgentScope", () => {
  it("returns solo scope when the agent owns no teams", () => {
    const out = buildAgentScope({
      selfAgentId: "a1",
      ownedTeamIds: [],
      rosterAgentIds: [],
    });
    expect(out).toEqual({
      selfAgentId: "a1",
      agentIds: ["a1"],
      scope: "agent",
      ownedTeamIds: [],
      primaryTeamId: null,
    });
  });

  it("returns team scope with the union of self + roster ids when the agent owns a team", () => {
    const out = buildAgentScope({
      selfAgentId: "owner-1",
      ownedTeamIds: ["t-1"],
      rosterAgentIds: ["owner-1", "member-1", "member-2"],
    });
    expect(out.scope).toBe("team");
    expect(out.ownedTeamIds).toEqual(["t-1"]);
    expect(out.primaryTeamId).toBe("t-1");
    // Order isn't specified; check membership.
    expect(new Set(out.agentIds)).toEqual(new Set(["owner-1", "member-1", "member-2"]));
  });

  it("dedupes when the roster query returns self", () => {
    const out = buildAgentScope({
      selfAgentId: "a1",
      ownedTeamIds: ["t-1"],
      rosterAgentIds: ["a1", "a1", "a2"],
    });
    expect(out.agentIds.length).toBe(2);
    expect(new Set(out.agentIds)).toEqual(new Set(["a1", "a2"]));
  });

  it("aggregates rosters across multiple owned teams", () => {
    const out = buildAgentScope({
      selfAgentId: "owner",
      ownedTeamIds: ["t-1", "t-2"],
      rosterAgentIds: ["owner", "m-a", "m-b", "owner", "m-c"],
    });
    expect(new Set(out.agentIds)).toEqual(new Set(["owner", "m-a", "m-b", "m-c"]));
    expect(out.primaryTeamId).toBe("t-1");
  });

  it("filters out empty-string ids defensively", () => {
    const out = buildAgentScope({
      selfAgentId: "a1",
      ownedTeamIds: ["t-1"],
      rosterAgentIds: ["", "a2", ""],
    });
    expect(new Set(out.agentIds)).toEqual(new Set(["a1", "a2"]));
  });

  it("includes self even when the roster query returns nothing (RLS edge case)", () => {
    const out = buildAgentScope({
      selfAgentId: "owner",
      ownedTeamIds: ["t-1"],
      rosterAgentIds: [],
    });
    expect(out.agentIds).toEqual(["owner"]);
    expect(out.scope).toBe("team");
  });
});

describe("soloScope", () => {
  it("matches the shape buildAgentScope produces with empty inputs", () => {
    const direct = soloScope("a1");
    const built = buildAgentScope({
      selfAgentId: "a1",
      ownedTeamIds: [],
      rosterAgentIds: [],
    });
    expect(direct).toEqual(built);
  });
});
