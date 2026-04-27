import { describe, expect, it } from "vitest";

import {
  describeStatus,
  formatDuration,
  groupByCall,
  type VoiceCallEventRow,
} from "@/lib/voiceCallTimeline/format";

function row(
  callSid: string,
  status: string,
  createdAt: string,
  meta: Partial<NonNullable<VoiceCallEventRow["metadata"]>> = {},
): VoiceCallEventRow {
  return {
    createdAt,
    metadata: {
      twilio_call_sid: callSid,
      status,
      duration_seconds: null,
      error_code: null,
      has_recording: false,
      ...meta,
    },
  };
}

describe("groupByCall", () => {
  it("returns empty array for empty input", () => {
    expect(groupByCall([])).toEqual([]);
  });

  it("groups four status events for the same call into one entry", () => {
    const rows = [
      row("CAabc", "initiated", "2026-04-27T14:02:11Z"),
      row("CAabc", "ringing", "2026-04-27T14:02:13Z"),
      row("CAabc", "in-progress", "2026-04-27T14:02:18Z"),
      row("CAabc", "completed", "2026-04-27T14:06:50Z", { duration_seconds: 272 }),
    ];
    const out = groupByCall(rows);
    expect(out).toHaveLength(1);
    expect(out[0].callSid).toBe("CAabc");
    expect(out[0].status).toBe("completed");
    expect(out[0].durationSeconds).toBe(272);
    expect(out[0].transitionCount).toBe(4);
  });

  it("uses the EARLIEST createdAt as the call start", () => {
    const rows = [
      row("CAabc", "completed", "2026-04-27T14:06:50Z"),
      row("CAabc", "initiated", "2026-04-27T14:02:11Z"),
      row("CAabc", "ringing", "2026-04-27T14:02:13Z"),
    ];
    const out = groupByCall(rows);
    expect(out[0].startedAt).toBe("2026-04-27T14:02:11Z");
  });

  it("picks terminal status over in-flight even if in-flight came later", () => {
    // Realistic ordering: terminal arrives last, so this is just the
    // baseline. But guard against an out-of-order event store too.
    const rows = [
      row("CAabc", "completed", "2026-04-27T14:06:50Z"),
      row("CAabc", "in-progress", "2026-04-27T14:07:00Z"), // out of order
    ];
    const out = groupByCall(rows);
    expect(out[0].status).toBe("completed");
  });

  it("uses the latest IN-FLIGHT status when no terminal exists", () => {
    const rows = [
      row("CAabc", "queued", "2026-04-27T14:02:11Z"),
      row("CAabc", "ringing", "2026-04-27T14:02:13Z"),
      row("CAabc", "in-progress", "2026-04-27T14:02:18Z"),
    ];
    const out = groupByCall(rows);
    expect(out[0].status).toBe("in-progress");
  });

  it("propagates error code from any event in the call", () => {
    const rows = [
      row("CAabc", "initiated", "2026-04-27T14:02:11Z"),
      row("CAabc", "failed", "2026-04-27T14:02:14Z", { error_code: "13225" }),
    ];
    const out = groupByCall(rows);
    expect(out[0].errorCode).toBe("13225");
    expect(out[0].status).toBe("failed");
  });

  it("flags has_recording when ANY event in the call had it", () => {
    const rows = [
      row("CAabc", "initiated", "2026-04-27T14:02:11Z"),
      row("CAabc", "completed", "2026-04-27T14:06:50Z", { has_recording: true }),
    ];
    expect(groupByCall(rows)[0].hasRecording).toBe(true);
  });

  it("groups multiple calls and sorts by startedAt desc", () => {
    const rows = [
      row("CAabc", "completed", "2026-04-27T14:06:50Z"),
      row("CAabc", "initiated", "2026-04-27T14:02:11Z"),
      row("CAxyz", "completed", "2026-04-27T16:00:00Z"),
      row("CAxyz", "initiated", "2026-04-27T15:55:00Z"),
    ];
    const out = groupByCall(rows);
    expect(out).toHaveLength(2);
    expect(out[0].callSid).toBe("CAxyz"); // later call first
    expect(out[1].callSid).toBe("CAabc");
  });

  it("ignores rows missing twilio_call_sid", () => {
    const rows = [
      row("CAabc", "completed", "2026-04-27T14:06:50Z"),
      { createdAt: "2026-04-27T14:00:00Z", metadata: { status: "completed" } },
    ];
    const out = groupByCall(rows);
    expect(out).toHaveLength(1);
    expect(out[0].callSid).toBe("CAabc");
  });

  it("ignores rows with unknown status (defensive)", () => {
    const rows = [
      row("CAabc", "warp-driving", "2026-04-27T14:00:00Z"),
      row("CAabc", "completed", "2026-04-27T14:06:50Z"),
    ];
    const out = groupByCall(rows);
    expect(out[0].transitionCount).toBe(1); // only the valid one counted
  });

  it("counts every event toward transitionCount", () => {
    const rows = [
      row("CAabc", "queued", "2026-04-27T14:02:09Z"),
      row("CAabc", "initiated", "2026-04-27T14:02:11Z"),
      row("CAabc", "ringing", "2026-04-27T14:02:13Z"),
      row("CAabc", "in-progress", "2026-04-27T14:02:18Z"),
      row("CAabc", "completed", "2026-04-27T14:06:50Z"),
    ];
    expect(groupByCall(rows)[0].transitionCount).toBe(5);
  });
});

describe("formatDuration", () => {
  it("renders null/undefined/non-finite as a dash", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(NaN)).toBe("—");
    expect(formatDuration(Infinity)).toBe("—");
  });

  it("renders sub-minute durations as Ns", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(59)).toBe("59s");
  });

  it("renders sub-hour durations as Nm Ss", () => {
    expect(formatDuration(60)).toBe("1m 0s");
    expect(formatDuration(272)).toBe("4m 32s");
    expect(formatDuration(3599)).toBe("59m 59s");
  });

  it("renders hour+ durations as Nh Mm", () => {
    expect(formatDuration(3600)).toBe("1h 0m");
    expect(formatDuration(3705)).toBe("1h 1m");
  });

  it("clamps negative values to zero", () => {
    expect(formatDuration(-5)).toBe("0s");
  });
});

describe("describeStatus", () => {
  it("maps each status to a label + tone", () => {
    expect(describeStatus("completed")).toEqual({ label: "Completed", tone: "success" });
    expect(describeStatus("ringing").tone).toBe("in-flight");
    expect(describeStatus("failed").tone).toBe("failed");
    expect(describeStatus("canceled").tone).toBe("neutral");
  });

  it("returns 'Failed' tone for busy + no-answer (they're effectively failures from the agent's view)", () => {
    expect(describeStatus("busy").tone).toBe("failed");
    expect(describeStatus("no-answer").tone).toBe("failed");
  });
});
