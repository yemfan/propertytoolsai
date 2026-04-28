import { describe, expect, it } from "vitest";
import {
  pickNextCloser,
  pickNextForNewLead,
  pickNextIsa,
  type TeamRoutingMember,
} from "../routing";

const NEVER = new Map<string, string>();

function m(
  agentId: string,
  role: TeamRoutingMember["role"],
  inRoundRobin = true,
): TeamRoutingMember {
  return { agentId, role, inRoundRobin };
}

describe("pickNextIsa", () => {
  it("returns null when no ISAs in the team", () => {
    expect(
      pickNextIsa(
        [m("owner", "owner"), m("a", "member"), m("b", "member")],
        NEVER,
      ),
    ).toBeNull();
  });

  it("returns null when ISAs exist but none are opted in", () => {
    expect(
      pickNextIsa([m("isa1", "isa", false), m("isa2", "isa", false)], NEVER),
    ).toBeNull();
  });

  it("picks among opted-in ISAs only", () => {
    expect(
      pickNextIsa([m("isa1", "isa"), m("a", "member"), m("isa2", "isa", false)], NEVER),
    ).toBe("isa1");
  });

  it("rotates through ISAs by least-recently-assigned", () => {
    const map = new Map<string, string>([
      ["isa1", "2026-04-15T00:00:00Z"],
      ["isa2", "2026-04-01T00:00:00Z"], // older → next pick
    ]);
    expect(pickNextIsa([m("isa1", "isa"), m("isa2", "isa")], map)).toBe("isa2");
  });
});

describe("pickNextCloser", () => {
  it("excludes ISAs", () => {
    const out = pickNextCloser(
      [m("isa1", "isa"), m("c1", "member")],
      NEVER,
    );
    expect(out).toBe("c1");
  });

  it("includes owners by default (small teams where owner closes)", () => {
    const out = pickNextCloser([m("owner1", "owner")], NEVER);
    expect(out).toBe("owner1");
  });

  it("excludes owners when includeOwners=false", () => {
    const out = pickNextCloser(
      [m("owner1", "owner"), m("c1", "member")],
      NEVER,
      { includeOwners: false },
    );
    expect(out).toBe("c1");
  });

  it("returns null when only opted-out closers remain", () => {
    expect(
      pickNextCloser(
        [m("c1", "member", false), m("isa1", "isa")],
        NEVER,
      ),
    ).toBeNull();
  });
});

describe("pickNextForNewLead", () => {
  it("returns ISA-tagged result when an ISA is in the pool", () => {
    const out = pickNextForNewLead(
      [m("isa1", "isa"), m("c1", "member")],
      NEVER,
    );
    expect(out).toEqual({ agentId: "isa1", pickedAs: "isa" });
  });

  it("falls through to closer when no ISAs configured", () => {
    const out = pickNextForNewLead([m("c1", "member")], NEVER);
    expect(out).toEqual({ agentId: "c1", pickedAs: "closer" });
  });

  it("falls through to closer when ISAs exist but all opted out", () => {
    const out = pickNextForNewLead(
      [m("isa1", "isa", false), m("c1", "member")],
      NEVER,
    );
    expect(out).toEqual({ agentId: "c1", pickedAs: "closer" });
  });

  it("returns null when nobody is eligible", () => {
    expect(pickNextForNewLead([], NEVER)).toBeNull();
    expect(
      pickNextForNewLead(
        [m("c1", "member", false), m("isa1", "isa", false)],
        NEVER,
      ),
    ).toBeNull();
  });
});
