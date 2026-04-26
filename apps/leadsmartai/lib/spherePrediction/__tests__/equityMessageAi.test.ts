import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildEquityPrompt,
  buildEquitySnapshot,
  generateEquityMessage,
  type EquityMessageInput,
} from "@/lib/spherePrediction/equityMessageAi";
import type { SphereSellerFactor } from "@/lib/spherePrediction/types";

function factor(
  id: SphereSellerFactor["id"],
  pointsEarned: number,
  detail: string,
): SphereSellerFactor {
  return {
    id,
    label: id,
    pointsEarned,
    pointsMax: 30,
    detail,
  };
}

function input(overrides: Partial<EquityMessageInput> = {}): EquityMessageInput {
  return {
    contactFirstName: "Sarah",
    contactFullName: "Sarah Chen",
    closingAddress: "123 Main St",
    closingPrice: 800_000,
    avmCurrent: 1_120_000,
    closingDate: "2018-06-15",
    lifecycleStage: "past_client",
    factors: [
      factor("tenure", 30, "Owned ~7.2y — peak sell window."),
      factor("equity_gain", 25, "Equity $320,000 (40%) since closing."),
    ],
    agentDisplayName: "Alex",
    ...overrides,
  };
}

describe("buildEquitySnapshot", () => {
  it("returns null line when prices are missing", () => {
    expect(buildEquitySnapshot({ closingPrice: null, avmCurrent: 1_000_000, closingDate: null }).line).toBeNull();
    expect(buildEquitySnapshot({ closingPrice: 500_000, avmCurrent: null, closingDate: null }).line).toBeNull();
  });

  it("returns null line for underwater equity (no negative-spin lines)", () => {
    const out = buildEquitySnapshot({
      closingPrice: 1_000_000,
      avmCurrent: 900_000,
      closingDate: null,
    });
    expect(out.line).toBeNull();
    expect(out.deltaDollars).toBe(-100_000);
  });

  it("renders dollars + pct + closing year when present", () => {
    const out = buildEquitySnapshot({
      closingPrice: 800_000,
      avmCurrent: 1_120_000,
      closingDate: "2018-06-15",
    });
    expect(out.line).toContain("$1.12M");
    expect(out.line).toContain("$320K");
    expect(out.line).toContain("40%");
    expect(out.line).toContain("2018");
    expect(out.deltaDollars).toBe(320_000);
  });

  it("renders without year when closing date is missing", () => {
    const out = buildEquitySnapshot({
      closingPrice: 800_000,
      avmCurrent: 1_120_000,
      closingDate: null,
    });
    expect(out.line).not.toMatch(/since \d{4}/i);
  });
});

describe("buildEquityPrompt", () => {
  it("includes the contact name + closing address + year", () => {
    const p = buildEquityPrompt(input());
    expect(p).toContain("Sarah Chen");
    expect(p).toContain("123 Main St");
    expect(p).toContain("2018");
  });

  it("includes the equity story line when equity is positive", () => {
    const p = buildEquityPrompt(input());
    expect(p).toMatch(/Equity story:/);
    expect(p).toContain("$1.12M");
    expect(p).toContain("40%");
  });

  it("picks a non-equity top factor as the 'why now' hint", () => {
    const p = buildEquityPrompt(
      input({
        factors: [
          factor("equity_gain", 25, "Equity $320,000 (40%) since closing."),
          factor("open_signals", 20, "Strongest open signal: refi detected (high)."),
        ],
      }),
    );
    expect(p).toContain("refi detected");
    // Equity story is its own line, but should not be in the "why now" line:
    expect(p.match(/Other reason to reach out today:/g)?.length ?? 0).toBe(1);
  });

  it("omits 'why now' when equity is the only earning factor", () => {
    const p = buildEquityPrompt(
      input({
        factors: [factor("equity_gain", 25, "Equity $320,000 (40%) since closing.")],
      }),
    );
    expect(p).not.toContain("Other reason to reach out today");
  });

  it("varies tone based on lifecycle stage", () => {
    const past = buildEquityPrompt(input({ lifecycleStage: "past_client" }));
    const sphere = buildEquityPrompt(input({ lifecycleStage: "sphere" }));
    expect(past).toContain("past client");
    expect(sphere).toContain("sphere contact");
  });

  it("forbids high-pressure phrases", () => {
    const p = buildEquityPrompt(input());
    expect(p).toMatch(/limited time/);
    expect(p).toMatch(/Do NOT use phrases like/);
  });

  it("threads the agent display name into the sign-off instruction", () => {
    const p = buildEquityPrompt(input({ agentDisplayName: "Casey" }));
    expect(p).toContain("Agent's name for sign-off: Casey");
  });
});

describe("generateEquityMessage — deterministic fallback (no OPENAI_API_KEY)", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  });

  it("returns aiPowered=false when key is missing", async () => {
    const out = await generateEquityMessage(input());
    expect(out.aiPowered).toBe(false);
  });

  it("uses the contact's first name and the agent's name", async () => {
    const out = await generateEquityMessage(input({ contactFirstName: "Sarah", agentDisplayName: "Alex" }));
    expect(out.sms).toContain("Sarah");
    expect(out.sms).toContain("Alex");
    expect(out.emailBody).toContain("Sarah");
    expect(out.emailBody).toContain("Alex");
  });

  it("falls back to 'there' / 'your agent' when names are missing", async () => {
    const out = await generateEquityMessage(
      input({ contactFirstName: null, contactFullName: "", agentDisplayName: null }),
    );
    expect(out.sms).toContain("there");
    expect(out.sms).toContain("your agent");
  });

  it("references the equity figure when equity is positive", async () => {
    const out = await generateEquityMessage(input());
    expect(out.emailBody).toContain("$1.12M");
    expect(out.emailBody).toContain("40%");
  });

  it("does not mention equity numbers when equity is negative or missing", async () => {
    const out = await generateEquityMessage(
      input({ closingPrice: 1_000_000, avmCurrent: 900_000 }),
    );
    expect(out.emailBody).not.toContain("$");
    expect(out.emailBody).toMatch(/market check-in/i);
  });

  it("SMS is capped at 320 characters", async () => {
    const longAddr = "A very long street address ".repeat(20);
    const out = await generateEquityMessage(input({ closingAddress: longAddr }));
    expect(out.sms.length).toBeLessThanOrEqual(320);
  });

  it("uses warmer language for past_client", async () => {
    const past = await generateEquityMessage(input({ lifecycleStage: "past_client" }));
    const sphere = await generateEquityMessage(input({ lifecycleStage: "sphere" }));
    expect(past.sms).toMatch(/settling in/);
    expect(sphere.sms).toMatch(/all's good/);
  });

  it("email subject mentions the closing address when present", async () => {
    const out = await generateEquityMessage(input({ closingAddress: "456 Oak Ave" }));
    expect(out.emailSubject).toContain("456 Oak Ave");
  });

  it("does not include high-pressure phrases in the fallback", async () => {
    const out = await generateEquityMessage(input());
    const all = `${out.sms}\n${out.emailSubject}\n${out.emailBody}`;
    expect(all).not.toMatch(/limited time/i);
    expect(all).not.toMatch(/I have buyers for your house/i);
    expect(all).not.toMatch(/act now/i);
  });
});
