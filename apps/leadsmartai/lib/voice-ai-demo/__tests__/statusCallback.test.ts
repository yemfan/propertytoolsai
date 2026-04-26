import { describe, expect, it } from "vitest";

import {
  buildStatusEventRow,
  parseStatusCallback,
} from "@/lib/voice-ai-demo/statusCallback";

describe("parseStatusCallback", () => {
  it("returns null when CallSid is missing", () => {
    expect(parseStatusCallback({ CallStatus: "ringing" })).toBeNull();
  });

  it("returns null when CallStatus is missing", () => {
    expect(parseStatusCallback({ CallSid: "CAxxx" })).toBeNull();
  });

  it("returns null for unknown / unsupported statuses (defensive)", () => {
    expect(
      parseStatusCallback({ CallSid: "CAxxx", CallStatus: "warp-driving" }),
    ).toBeNull();
  });

  it("parses a minimal queued event", () => {
    const out = parseStatusCallback({ CallSid: "CAabc123", CallStatus: "queued" });
    expect(out).toEqual({
      callSid: "CAabc123",
      status: "queued",
      durationSeconds: null,
      from: null,
      to: null,
      recordingUrl: null,
      errorCode: null,
    });
  });

  it("parses a complete completed event with duration", () => {
    const out = parseStatusCallback({
      CallSid: "CAabc123",
      CallStatus: "completed",
      CallDuration: "272",
      From: "+14155550100",
      To: "+14155550199",
      RecordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC/Recordings/RE",
    });
    expect(out?.status).toBe("completed");
    expect(out?.durationSeconds).toBe(272);
    expect(out?.from).toBe("+14155550100");
    expect(out?.to).toBe("+14155550199");
    expect(out?.recordingUrl).toContain("Recordings/RE");
  });

  it("parses a failed event with an error code", () => {
    const out = parseStatusCallback({
      CallSid: "CAabc123",
      CallStatus: "failed",
      ErrorCode: "13225",
    });
    expect(out?.status).toBe("failed");
    expect(out?.errorCode).toBe("13225");
  });

  it("ignores invalid CallDuration (non-numeric)", () => {
    const out = parseStatusCallback({
      CallSid: "CAabc123",
      CallStatus: "completed",
      CallDuration: "n/a",
    });
    expect(out?.durationSeconds).toBeNull();
  });

  it("treats whitespace-only string fields as missing", () => {
    const out = parseStatusCallback({
      CallSid: "CAabc123",
      CallStatus: "ringing",
      From: "   ",
      To: "",
    });
    expect(out?.from).toBeNull();
    expect(out?.to).toBeNull();
  });

  it("accepts every documented Twilio status", () => {
    const statuses = [
      "queued",
      "initiated",
      "ringing",
      "in-progress",
      "completed",
      "busy",
      "no-answer",
      "failed",
      "canceled",
    ];
    for (const s of statuses) {
      const out = parseStatusCallback({ CallSid: "CAabc", CallStatus: s });
      expect(out, `status=${s}`).not.toBeNull();
      expect(out?.status).toBe(s);
    }
  });
});

describe("buildStatusEventRow", () => {
  it("emits the locked event_type + source", () => {
    const parsed = {
      callSid: "CAabc",
      status: "completed" as const,
      durationSeconds: 272,
      from: null,
      to: null,
      recordingUrl: null,
      errorCode: null,
    };
    const row = buildStatusEventRow(parsed);
    expect(row.event_type).toBe("voice_demo_call_status");
    expect(row.source).toBe("voice_ai_demo");
  });

  it("preserves call sid + duration in metadata", () => {
    const parsed = {
      callSid: "CAabc",
      status: "completed" as const,
      durationSeconds: 272,
      from: null,
      to: null,
      recordingUrl: null,
      errorCode: null,
    };
    const row = buildStatusEventRow(parsed);
    expect(row.metadata.twilio_call_sid).toBe("CAabc");
    expect(row.metadata.duration_seconds).toBe(272);
  });

  it("flags has_recording when recordingUrl is present", () => {
    const withRec = buildStatusEventRow({
      callSid: "CAabc",
      status: "completed",
      durationSeconds: 272,
      from: null,
      to: null,
      recordingUrl: "https://api.twilio.com/2010-04-01/Recordings/RE",
      errorCode: null,
    });
    expect(withRec.metadata.has_recording).toBe(true);

    const withoutRec = buildStatusEventRow({
      callSid: "CAabc",
      status: "completed",
      durationSeconds: 272,
      from: null,
      to: null,
      recordingUrl: null,
      errorCode: null,
    });
    expect(withoutRec.metadata.has_recording).toBe(false);
  });

  it("propagates Twilio error code on failures", () => {
    const row = buildStatusEventRow({
      callSid: "CAabc",
      status: "failed",
      durationSeconds: null,
      from: null,
      to: null,
      recordingUrl: null,
      errorCode: "13225",
    });
    expect(row.metadata.error_code).toBe("13225");
  });
});
