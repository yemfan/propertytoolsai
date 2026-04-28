import { describe, expect, it } from "vitest";
import { planHandoff } from "../handoff";
import type { TeamRoutingMember } from "../routing";

const NEVER = new Map<string, string>();

function m(
  agentId: string,
  role: TeamRoutingMember["role"],
  inRoundRobin = true,
): TeamRoutingMember {
  return { agentId, role, inRoundRobin };
}

describe("planHandoff (qualified path)", () => {
  it("plans an ISA → closer handoff on the happy path", () => {
    const out = planHandoff({
      currentAssignee: { agentId: "isa1", role: "isa" },
      members: [m("isa1", "isa"), m("c1", "member"), m("c2", "member")],
      lastAssignedAt: NEVER,
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.plan.fromAgentId).toBe("isa1");
      expect(["c1", "c2"]).toContain(out.plan.toAgentId);
      expect(out.plan.reason).toBe("qualified");
    }
  });

  it("rejects qualified handoffs when the from-side isn't an ISA", () => {
    const out = planHandoff({
      currentAssignee: { agentId: "c1", role: "member" },
      members: [m("c1", "member"), m("c2", "member")],
      lastAssignedAt: NEVER,
    });
    expect(out).toEqual({ ok: false, reason: "from_not_isa" });
  });

  it("rejects when the team has no eligible closers", () => {
    const out = planHandoff({
      currentAssignee: { agentId: "isa1", role: "isa" },
      members: [m("isa1", "isa"), m("isa2", "isa")],
      lastAssignedAt: NEVER,
    });
    expect(out).toEqual({ ok: false, reason: "no_eligible_closer" });
  });

  it("uses round-robin to pick among multiple closers", () => {
    const map = new Map<string, string>([
      ["c1", "2026-04-15T00:00:00Z"],
      ["c2", "2026-04-01T00:00:00Z"], // older → next pick
    ]);
    const out = planHandoff({
      currentAssignee: { agentId: "isa1", role: "isa" },
      members: [m("isa1", "isa"), m("c1", "member"), m("c2", "member")],
      lastAssignedAt: map,
    });
    expect(out.ok && out.plan.toAgentId).toBe("c2");
  });
});

describe("planHandoff (manual path)", () => {
  it("allows manual handoffs from any role (e.g. owner reassigning)", () => {
    const out = planHandoff({
      currentAssignee: { agentId: "owner1", role: "owner" },
      members: [m("owner1", "owner"), m("c1", "member")],
      lastAssignedAt: NEVER,
      reason: "manual",
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.plan.toAgentId).toBe("c1");
      expect(out.plan.reason).toBe("manual");
    }
  });

  it("rejects manual handoff that picks the same agent", () => {
    // Single eligible closer is the same as the current assignee.
    const out = planHandoff({
      currentAssignee: { agentId: "c1", role: "member" },
      members: [m("c1", "member")],
      lastAssignedAt: NEVER,
      reason: "manual",
    });
    expect(out).toEqual({ ok: false, reason: "from_equals_to" });
  });
});

describe("planHandoff (rebalance reason)", () => {
  it("uses rebalance as the recorded reason when supplied", () => {
    const out = planHandoff({
      currentAssignee: { agentId: "isa1", role: "isa" },
      members: [m("isa1", "isa"), m("c1", "member")],
      lastAssignedAt: NEVER,
      reason: "rebalance",
    });
    expect(out.ok && out.plan.reason).toBe("rebalance");
  });
});
