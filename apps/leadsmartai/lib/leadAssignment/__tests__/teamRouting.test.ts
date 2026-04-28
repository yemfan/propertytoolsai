import { describe, expect, it } from "vitest";
import {
  eligibleTeamMembers,
  pickNextTeamMember,
  type TeamMemberRoutingRow,
} from "../teamRouting";

const NEVER = new Map<string, string>();

describe("eligibleTeamMembers", () => {
  it("returns only opted-in members", () => {
    const members: TeamMemberRoutingRow[] = [
      { agentId: "a1", inRoundRobin: true },
      { agentId: "a2", inRoundRobin: false },
      { agentId: "a3", inRoundRobin: true },
    ];
    expect(eligibleTeamMembers(members)).toEqual(["a1", "a3"]);
  });

  it("filters out empty agent ids defensively", () => {
    const members: TeamMemberRoutingRow[] = [
      { agentId: "", inRoundRobin: true },
      { agentId: "a2", inRoundRobin: true },
    ];
    expect(eligibleTeamMembers(members)).toEqual(["a2"]);
  });
});

describe("pickNextTeamMember", () => {
  it("returns null when no member opted in", () => {
    const out = pickNextTeamMember({
      members: [
        { agentId: "a1", inRoundRobin: false },
        { agentId: "a2", inRoundRobin: false },
      ],
      lastAssignedAt: NEVER,
    });
    expect(out).toBeNull();
  });

  it("picks the never-assigned member first (alphabetical tie-break)", () => {
    const out = pickNextTeamMember({
      members: [
        { agentId: "b", inRoundRobin: true },
        { agentId: "a", inRoundRobin: true },
      ],
      lastAssignedAt: NEVER,
    });
    expect(out).toBe("a");
  });

  it("skips opted-out members even if they would otherwise be the oldest", () => {
    const map = new Map<string, string>([
      ["a1", "2020-01-01T00:00:00Z"], // very old, but opted out
      ["a2", "2026-04-01T00:00:00Z"],
    ]);
    const out = pickNextTeamMember({
      members: [
        { agentId: "a1", inRoundRobin: false },
        { agentId: "a2", inRoundRobin: true },
      ],
      lastAssignedAt: map,
    });
    expect(out).toBe("a2");
  });

  it("among opted-in members, picks the least-recently-assigned", () => {
    const map = new Map<string, string>([
      ["a1", "2026-04-01T00:00:00Z"],
      ["a2", "2026-04-15T00:00:00Z"],
      ["a3", "2026-04-20T00:00:00Z"],
    ]);
    const out = pickNextTeamMember({
      members: [
        { agentId: "a1", inRoundRobin: true },
        { agentId: "a2", inRoundRobin: true },
        { agentId: "a3", inRoundRobin: true },
      ],
      lastAssignedAt: map,
    });
    expect(out).toBe("a1");
  });

  it("returns null on an empty members list", () => {
    expect(
      pickNextTeamMember({ members: [], lastAssignedAt: NEVER }),
    ).toBeNull();
  });
});
