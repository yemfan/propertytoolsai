import { describe, expect, it } from "vitest";
import {
  BUYER_REP_TASK_COUNT,
  DUAL_AGENCY_TASK_COUNT,
  LISTING_REP_TASK_COUNT,
  seedTasksFor,
} from "../seedTasks";

describe("seedTasksFor", () => {
  it("returns buyer-rep tasks with only mutual_acceptance anchors", () => {
    const tasks = seedTasksFor("buyer_rep");
    expect(tasks.length).toBe(BUYER_REP_TASK_COUNT);
    expect(tasks.every((t) => t.anchor === "mutual_acceptance")).toBe(true);
  });

  it("returns listing-rep tasks spanning both anchors", () => {
    const tasks = seedTasksFor("listing_rep");
    expect(tasks.length).toBe(LISTING_REP_TASK_COUNT);
    const anchors = new Set(tasks.map((t) => t.anchor));
    expect(anchors).toEqual(new Set(["listing_start", "mutual_acceptance"]));
  });

  it("returns dual-agency tasks with disclosed-agency guardrails", () => {
    const tasks = seedTasksFor("dual");
    expect(tasks.length).toBe(DUAL_AGENCY_TASK_COUNT);
    expect(tasks.length).toBeGreaterThan(0);
    // Dual agency in CA is legally distinct — the agency-disclosure task
    // must be present or the whole representation is defective.
    expect(tasks.some((t) => t.seedKey === "dual_disclose_agency")).toBe(true);
    expect(tasks.some((t) => t.seedKey === "dual_confirm_dual_rep_consent")).toBe(true);
    // Wire verification is more critical in dual (both sides' wires flow
    // through the same agent's attention) — its seed_key is the dual
    // variant, not the buyer one.
    expect(tasks.some((t) => t.seedKey === "dual_verify_wire_instructions")).toBe(true);
  });

  it("all seedKeys are unique across all three templates", () => {
    const all = [
      ...seedTasksFor("buyer_rep"),
      ...seedTasksFor("listing_rep"),
      ...seedTasksFor("dual"),
    ];
    const keys = all.map((t) => t.seedKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("listing-rep does NOT duplicate the buyer verify_wire_instructions key", () => {
    // Listing side doesn't send wires — seller receives proceeds. So
    // we deliberately don't ship a 'verify_wire_instructions' for
    // listing-rep. This guard ensures we didn't accidentally duplicate
    // the buyer key across templates.
    const tasks = seedTasksFor("listing_rep");
    expect(tasks.some((t) => t.seedKey === "verify_wire_instructions")).toBe(false);
  });
});
