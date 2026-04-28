import { describe, expect, it } from "vitest";
import { getSalesModel } from "@/lib/sales-models";
import {
  buildPipelineActivity,
  EMPTY_ACTIVITY_SNAPSHOT,
  type ActivitySnapshot,
} from "../pipelineActivity";

function snap(overrides: Partial<ActivitySnapshot> = {}): ActivitySnapshot {
  return { ...EMPTY_ACTIVITY_SNAPSHOT, ...overrides };
}

describe("buildPipelineActivity", () => {
  it("returns an entry per stage in model order", () => {
    const model = getSalesModel("influencer");
    const out = buildPipelineActivity(model, snap());
    expect(out).toHaveLength(model.pipeline.length);
  });

  it("influencer: maps active+closed transactions to the last two stages", () => {
    const model = getSalesModel("influencer");
    const out = buildPipelineActivity(
      model,
      snap({ activeTransactionCount: 4, closedTransactionCount: 21 }),
    );
    expect(out[out.length - 1]).toEqual({ count: 21, label: "all-time" });
    expect(out[out.length - 2]).toEqual({ count: 4, label: "active" });
  });

  it("influencer: surfaces total contacts under Audience and new contacts under DM Lead", () => {
    const model = getSalesModel("influencer");
    const out = buildPipelineActivity(
      model,
      snap({ totalContacts: 412, newContactsLast7d: 9 }),
    );
    expect(out[0]).toEqual({ count: 412, label: "all-time" });
    expect(out[1]).toEqual({ count: 9, label: "this week" });
  });

  it("influencer: warm+ shows under Qualified, upcoming under Consultation", () => {
    const model = getSalesModel("influencer");
    const out = buildPipelineActivity(
      model,
      snap({ hotContactCount: 7, upcomingTouchpoints: 3 }),
    );
    expect(out[2]).toEqual({ count: 7, label: "warm+" });
    expect(out[3]).toEqual({ count: 3, label: "next 7d" });
  });

  it("closer: leads under Prospect, contacted-this-week under Contacted", () => {
    const model = getSalesModel("closer");
    const out = buildPipelineActivity(
      model,
      snap({ leadCount: 18, contactedLast7d: 11 }),
    );
    expect(out[0]).toEqual({ count: 18, label: "open" });
    expect(out[1]).toEqual({ count: 11, label: "this week" });
  });

  it("advisor: 7 stages, active client count surfaces at Decision (idx 4)", () => {
    const model = getSalesModel("advisor");
    expect(model.pipeline).toHaveLength(7);
    const out = buildPipelineActivity(model, snap({ activeClientCount: 6 }));
    expect(out[4]).toEqual({ count: 6, label: "active" });
  });

  it("custom: short 5-stage pipeline still gets last-two transaction mapping", () => {
    const model = getSalesModel("custom");
    expect(model.pipeline).toHaveLength(5);
    const out = buildPipelineActivity(
      model,
      snap({ activeTransactionCount: 2, closedTransactionCount: 8 }),
    );
    expect(out[3]).toEqual({ count: 2, label: "active" });
    expect(out[4]).toEqual({ count: 8, label: "all-time" });
  });

  it("renders zeros (not nulls) when the snapshot is empty so the UI shows real progress", () => {
    const model = getSalesModel("closer");
    const out = buildPipelineActivity(model, snap());
    // First and last are always defined for every model.
    expect(out[0].count).toBe(0);
    expect(out[out.length - 1].count).toBe(0);
  });
});
