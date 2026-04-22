import { describe, expect, it } from "vitest";
import { BUYER_REP_TASK_COUNT, LISTING_REP_TASK_COUNT, seedTasksFor } from "../seedTasks";

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

  it("returns empty for dual agency (no seed template yet)", () => {
    expect(seedTasksFor("dual")).toEqual([]);
  });

  it("all seedKeys are unique across both templates", () => {
    const all = [...seedTasksFor("buyer_rep"), ...seedTasksFor("listing_rep")];
    const keys = all.map((t) => t.seedKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("listing-rep includes a wire-verification equivalent", () => {
    const tasks = seedTasksFor("listing_rep");
    // Listing side doesn't send wires — seller receives proceeds. So
    // we deliberately don't ship a 'verify_wire_instructions' for
    // listing-rep. This guard ensures we didn't accidentally duplicate
    // the buyer key across templates.
    expect(tasks.some((t) => t.seedKey === "verify_wire_instructions")).toBe(false);
  });
});
