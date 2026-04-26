import { describe, expect, it } from "vitest";

import {
  buildOutboundDemoTwiml,
  OUTBOUND_DEMO_PROMPTS,
} from "@/lib/voice-ai-demo/twiml";

describe("buildOutboundDemoTwiml", () => {
  const baseArgs = {
    gatherActionUrl: "https://example.com/api/twilio/voice/inbound",
  };

  it("emits a valid TwiML <Response> envelope", () => {
    const xml = buildOutboundDemoTwiml(baseArgs);
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml).toContain("<Response>");
    expect(xml).toContain("</Response>");
  });

  it("includes the demo-specific greeting (not the inbound 'thanks for calling' copy)", () => {
    const xml = buildOutboundDemoTwiml(baseArgs);
    expect(xml).toContain(OUTBOUND_DEMO_PROMPTS.greeting);
    // Inbound flow's greeting must NOT appear here — confirms we built the
    // outbound-specific TwiML, not just borrowed the inbound builder.
    expect(xml).not.toContain("thanks for calling");
  });

  it("forwards speech to the supplied gatherActionUrl", () => {
    const xml = buildOutboundDemoTwiml({
      gatherActionUrl: "https://demo.app/inbound",
    });
    expect(xml).toContain('action="https://demo.app/inbound"');
  });

  it("uses speech-only input (no DTMF capture)", () => {
    const xml = buildOutboundDemoTwiml(baseArgs);
    expect(xml).toContain('input="speech"');
    expect(xml).not.toMatch(/input="dtmf"/);
  });

  it("includes the gather reprompt as a graceful no-input fallback", () => {
    const xml = buildOutboundDemoTwiml(baseArgs);
    expect(xml).toContain(OUTBOUND_DEMO_PROMPTS.gatherReprompt);
  });

  it("hangs up cleanly at the end", () => {
    const xml = buildOutboundDemoTwiml(baseArgs);
    expect(xml).toContain("<Hangup");
  });

  it("includes a 'hand me to a human' speech hint so the AI doesn't dig in", () => {
    const xml = buildOutboundDemoTwiml(baseArgs);
    // The demo absolutely must not pressure — verify the hint is there.
    expect(xml).toMatch(/hand off|human/i);
  });

  it("mentions 'demo' in the greeting so the prospect knows the context", () => {
    expect(OUTBOUND_DEMO_PROMPTS.greeting.toLowerCase()).toContain("demo");
  });
});
