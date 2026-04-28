import { describe, expect, it } from "vitest";
import {
  buildTeamBreakdown,
  EMPTY_MEMBER_METRICS,
  type MemberBreakdownRow,
} from "../breakdown";

function row(
  agentId: string,
  role: "owner" | "member",
  overrides: Partial<MemberBreakdownRow> = {},
): MemberBreakdownRow {
  return {
    agentId,
    role,
    ...EMPTY_MEMBER_METRICS,
    ...overrides,
  };
}

describe("buildTeamBreakdown", () => {
  it("returns empty totals + empty rows for an empty roster", () => {
    const out = buildTeamBreakdown([]);
    expect(out.rows).toEqual([]);
    expect(out.totals).toEqual(EMPTY_MEMBER_METRICS);
  });

  it("places the owner first regardless of metric order", () => {
    const out = buildTeamBreakdown([
      row("m1", "member", { transactionsClosedYtd: 5 }),
      row("owner-1", "owner", { transactionsClosedYtd: 1 }),
      row("m2", "member", { transactionsClosedYtd: 3 }),
    ]);
    expect(out.rows[0].agentId).toBe("owner-1");
    expect(out.rows[0].role).toBe("owner");
  });

  it("sorts members by closed-ytd desc, then by contacts desc", () => {
    const out = buildTeamBreakdown([
      row("owner-1", "owner"),
      row("m-a", "member", { transactionsClosedYtd: 2, contactsTotal: 50 }),
      row("m-b", "member", { transactionsClosedYtd: 5, contactsTotal: 10 }),
      row("m-c", "member", { transactionsClosedYtd: 2, contactsTotal: 80 }),
    ]);
    expect(out.rows.map((r) => r.agentId)).toEqual([
      "owner-1",
      "m-b",
      "m-c",
      "m-a",
    ]);
  });

  it("falls back to agentId asc on full ties for determinism", () => {
    const out = buildTeamBreakdown([
      row("owner-1", "owner"),
      row("z", "member"),
      row("a", "member"),
      row("m", "member"),
    ]);
    expect(out.rows.slice(1).map((r) => r.agentId)).toEqual(["a", "m", "z"]);
  });

  it("totals each metric across all rows", () => {
    const out = buildTeamBreakdown([
      row("owner-1", "owner", {
        contactsTotal: 100,
        leadsHot: 5,
        tasksCompletedLast30d: 12,
        tasksOpen: 3,
        transactionsActive: 1,
        transactionsClosedYtd: 8,
      }),
      row("m1", "member", {
        contactsTotal: 60,
        leadsHot: 2,
        tasksCompletedLast30d: 4,
        tasksOpen: 5,
        transactionsActive: 2,
        transactionsClosedYtd: 3,
      }),
    ]);
    expect(out.totals).toEqual({
      contactsTotal: 160,
      leadsHot: 7,
      tasksCompletedLast30d: 16,
      tasksOpen: 8,
      transactionsActive: 3,
      transactionsClosedYtd: 11,
    });
  });

  it("doesn't mutate the input array", () => {
    const input: MemberBreakdownRow[] = [
      row("z", "member", { transactionsClosedYtd: 1 }),
      row("owner-1", "owner"),
    ];
    const before = input.map((r) => r.agentId);
    buildTeamBreakdown(input);
    expect(input.map((r) => r.agentId)).toEqual(before);
  });
});
