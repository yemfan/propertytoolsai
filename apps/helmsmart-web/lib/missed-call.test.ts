import { describe, it, expect } from "vitest";
import { classifyMissed } from "./missed-call";

describe("classifyMissed", () => {
  it("treats voicemail / answering machine as voicemail (regardless of turns)", () => {
    expect(classifyMissed({ disconnectionReason: "voicemail_reached", userTurns: 0 })).toEqual({ status: "voicemail" });
    expect(classifyMissed({ disconnectionReason: "machine_detected", userTurns: 4 })).toEqual({ status: "voicemail" });
  });

  it("treats failed / no-answer / timeout disconnects as missed", () => {
    for (const reason of ["dial_no_answer", "dial_busy", "dial_failed", "inactivity", "registered_call_timeout"]) {
      expect(classifyMissed({ disconnectionReason: reason, userTurns: 0 })).toEqual({ status: "missed" });
    }
  });

  it("treats any error* reason as missed, even if the caller spoke", () => {
    expect(classifyMissed({ disconnectionReason: "error_llm_websocket_open", userTurns: 0 })).toEqual({ status: "missed" });
    expect(classifyMissed({ disconnectionReason: "error_twilio", userTurns: 5 })).toEqual({ status: "missed" });
    expect(classifyMissed({ disconnectionReason: "error", userTurns: 2 })).toEqual({ status: "missed" });
  });

  it("texts back when the caller hung up on the AI without speaking (zero turns)", () => {
    expect(classifyMissed({ disconnectionReason: "user_hangup", userTurns: 0 })).toEqual({ status: "missed" });
    expect(classifyMissed({ disconnectionReason: "", userTurns: 0 })).toEqual({ status: "missed" });
  });

  it("does NOT text back an engaged conversation (the caller was served)", () => {
    expect(classifyMissed({ disconnectionReason: "user_hangup", userTurns: 1 })).toBeNull();
    expect(classifyMissed({ disconnectionReason: "agent_hangup", userTurns: 3 })).toBeNull();
    expect(classifyMissed({ disconnectionReason: "call_transfer", userTurns: 2 })).toBeNull();
    expect(classifyMissed({ disconnectionReason: "max_duration_reached", userTurns: 8 })).toBeNull();
    expect(classifyMissed({ disconnectionReason: "", userTurns: 4 })).toBeNull();
  });

  it("prioritizes voicemail/error over engagement", () => {
    // Even with turns exchanged, a machine answer or an errored call still warrants a text.
    expect(classifyMissed({ disconnectionReason: "voicemail_reached", userTurns: 6 })).toEqual({ status: "voicemail" });
    expect(classifyMissed({ disconnectionReason: "error_asr", userTurns: 6 })).toEqual({ status: "missed" });
  });
});
