import { describe, expect, it } from "vitest";
import { parseTwilioStatusCallback } from "../statusCallback";

describe("parseTwilioStatusCallback", () => {
  it("maps Twilio CallStatus values to our canonical enum", () => {
    expect(parseTwilioStatusCallback({ CallSid: "CA1", CallStatus: "queued" })?.status).toBe("queued");
    expect(parseTwilioStatusCallback({ CallSid: "CA1", CallStatus: "ringing" })?.status).toBe("ringing");
    expect(parseTwilioStatusCallback({ CallSid: "CA1", CallStatus: "in-progress" })?.status).toBe("in_progress");
    expect(parseTwilioStatusCallback({ CallSid: "CA1", CallStatus: "completed" })?.status).toBe("completed");
    expect(parseTwilioStatusCallback({ CallSid: "CA1", CallStatus: "failed" })?.status).toBe("failed");
  });

  it("collapses busy / no-answer / canceled into a single 'missed' status", () => {
    expect(parseTwilioStatusCallback({ CallSid: "CA1", CallStatus: "busy" })?.status).toBe("missed");
    expect(parseTwilioStatusCallback({ CallSid: "CA1", CallStatus: "no-answer" })?.status).toBe("missed");
    expect(parseTwilioStatusCallback({ CallSid: "CA1", CallStatus: "canceled" })?.status).toBe("missed");
  });

  it("is case-insensitive on CallStatus", () => {
    expect(parseTwilioStatusCallback({ CallSid: "CA1", CallStatus: "RINGING" })?.status).toBe("ringing");
    expect(parseTwilioStatusCallback({ CallSid: "CA1", CallStatus: "Completed" })?.status).toBe("completed");
  });

  it("returns null when CallSid is missing", () => {
    expect(parseTwilioStatusCallback({ CallStatus: "completed" })).toBeNull();
    expect(parseTwilioStatusCallback({ CallSid: "", CallStatus: "completed" })).toBeNull();
    expect(parseTwilioStatusCallback({ CallSid: "   ", CallStatus: "completed" })).toBeNull();
  });

  it("returns null when CallStatus is unrecognized", () => {
    expect(parseTwilioStatusCallback({ CallSid: "CA1", CallStatus: "experimental-status" })).toBeNull();
    expect(parseTwilioStatusCallback({ CallSid: "CA1" })).toBeNull();
  });

  it("parses CallDuration as seconds", () => {
    const out = parseTwilioStatusCallback({
      CallSid: "CA1",
      CallStatus: "completed",
      CallDuration: "42",
    });
    expect(out?.durationSeconds).toBe(42);
  });

  it("returns null duration on missing or malformed input", () => {
    const noDur = parseTwilioStatusCallback({
      CallSid: "CA1",
      CallStatus: "completed",
    });
    expect(noDur?.durationSeconds).toBeNull();

    const badDur = parseTwilioStatusCallback({
      CallSid: "CA1",
      CallStatus: "completed",
      CallDuration: "not-a-number",
    });
    expect(badDur?.durationSeconds).toBeNull();
  });

  it("preserves the full form payload in `raw` for forensics", () => {
    const out = parseTwilioStatusCallback({
      CallSid: "CA1",
      CallStatus: "completed",
      AnsweredBy: "human",
      RecordingUrl: "https://example.com/r.mp3",
    });
    expect(out?.raw).toMatchObject({
      AnsweredBy: "human",
      RecordingUrl: "https://example.com/r.mp3",
    });
  });

  it("rejects negative or non-finite durations", () => {
    expect(
      parseTwilioStatusCallback({
        CallSid: "CA1",
        CallStatus: "completed",
        CallDuration: "-1",
      })?.durationSeconds,
    ).toBeNull();
    expect(
      parseTwilioStatusCallback({
        CallSid: "CA1",
        CallStatus: "completed",
        CallDuration: "Infinity",
      })?.durationSeconds,
    ).toBeNull();
  });
});
