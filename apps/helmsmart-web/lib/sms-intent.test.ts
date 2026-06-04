import { describe, it, expect } from "vitest";
import { isCancelRequest, isAffirmative } from "./sms-intent";

describe("isCancelRequest", () => {
  it("matches cancel intents", () => {
    for (const s of [
      "cancel",
      "Cancel",
      "I need to cancel",
      "cancel my appointment",
      "please cancel my booking",
      "cancelled",
      "canceling",
    ]) {
      expect(isCancelRequest(s)).toBe(true);
    }
  });

  it("ignores unrelated / reschedule messages", () => {
    for (const s of ["reschedule please", "what time?", "yes", "no thanks", ""]) {
      expect(isCancelRequest(s)).toBe(false);
    }
  });
});

describe("isAffirmative", () => {
  it("matches short confirmations", () => {
    for (const s of ["yes", "Yes please", "YEP", "ok", "Okay", "sure", "confirm", "Confirmed", "y", "go ahead", "do it", "yes."]) {
      expect(isAffirmative(s)).toBe(true);
    }
  });

  it("rejects non-affirmatives (incl. opt-out + bare cancel + lookalikes)", () => {
    for (const s of ["no", "not now", "maybe", "yesterday", "stop", "cancel", "no thanks", ""]) {
      expect(isAffirmative(s)).toBe(false);
    }
  });
});
