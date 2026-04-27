import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildBuyerOutreachPrompt,
  buildEquityToUpgradeSnapshot,
  generateBuyerOutreachMessage,
  pickOutreachAngle,
  type BuyerOutreachInput,
} from "@/lib/buyerPrediction/buyerOutreachAi";
import type { BuyerPredictionFactor } from "@/lib/buyerPrediction/types";

function factor(
  id: BuyerPredictionFactor["id"],
  pointsEarned: number,
  detail: string,
): BuyerPredictionFactor {
  return { id, label: id, pointsEarned, pointsMax: 30, detail };
}

function input(overrides: Partial<BuyerOutreachInput> = {}): BuyerOutreachInput {
  return {
    contactFirstName: "Sarah",
    contactFullName: "Sarah Chen",
    closingAddress: "123 Main St",
    closingPrice: 800_000,
    avmCurrent: 1_120_000,
    closingDate: "2018-06-15",
    lifecycleStage: "past_client",
    factors: [
      factor("tenure", 25, "Owned ~7.2y — peak move-up window."),
      factor("buyer_intent_signals", 24, "Strongest buyer signal: job change (high)."),
    ],
    topSignalType: "job_change",
    agentDisplayName: "Alex",
    ...overrides,
  };
}

describe("buildEquityToUpgradeSnapshot", () => {
  it("returns null line when prices are missing", () => {
    expect(
      buildEquityToUpgradeSnapshot({ closingPrice: null, avmCurrent: 1_000_000, closingDate: null }).line,
    ).toBeNull();
    expect(
      buildEquityToUpgradeSnapshot({ closingPrice: 500_000, avmCurrent: null, closingDate: null }).line,
    ).toBeNull();
  });

  it("returns null line for non-positive equity (no negative-spin)", () => {
    expect(
      buildEquityToUpgradeSnapshot({
        closingPrice: 1_000_000,
        avmCurrent: 900_000,
        closingDate: null,
      }).line,
    ).toBeNull();
  });

  it("renders dollars + pct + closing year and frames as 'equity built up'", () => {
    const out = buildEquityToUpgradeSnapshot({
      closingPrice: 800_000,
      avmCurrent: 1_120_000,
      closingDate: "2018-06-15",
    });
    expect(out.line).toContain("$320K");
    expect(out.line).toContain("40%");
    expect(out.line).toContain("2018");
    expect(out.line).toContain("equity built up");
  });
});

describe("pickOutreachAngle", () => {
  it("relocation when topSignalType is job_change", () => {
    expect(pickOutreachAngle(input({ topSignalType: "job_change" }))).toBe("relocation");
  });

  it("life_change when topSignalType is life_event_other", () => {
    expect(pickOutreachAngle(input({ topSignalType: "life_event_other" }))).toBe("life_change");
  });

  it("cash_out_move when topSignalType is refi_detected", () => {
    expect(pickOutreachAngle(input({ topSignalType: "refi_detected" }))).toBe("cash_out_move");
  });

  it("equity_upgrade when no signal but positive equity", () => {
    const i = input({
      topSignalType: null,
      closingPrice: 500_000,
      avmCurrent: 800_000,
      closingDate: "2020-01-01",
    });
    expect(pickOutreachAngle(i)).toBe("equity_upgrade");
  });

  it("general_check_in when no signal AND no positive equity", () => {
    const i = input({
      topSignalType: null,
      closingPrice: null,
      avmCurrent: null,
      closingDate: null,
    });
    expect(pickOutreachAngle(i)).toBe("general_check_in");
  });

  it("general_check_in for negative-equity rather than equity_upgrade", () => {
    const i = input({
      topSignalType: null,
      closingPrice: 1_000_000,
      avmCurrent: 900_000,
      closingDate: "2022-01-01",
    });
    expect(pickOutreachAngle(i)).toBe("general_check_in");
  });
});

describe("buildBuyerOutreachPrompt", () => {
  it("includes the contact name + closing address + year", () => {
    const p = buildBuyerOutreachPrompt(input());
    expect(p).toContain("Sarah Chen");
    expect(p).toContain("123 Main St");
    expect(p).toContain("2018");
  });

  it("describes the audience as someone likely to BUY their NEXT home", () => {
    const p = buildBuyerOutreachPrompt(input());
    expect(p).toMatch(/likely to BUY their next home/);
  });

  it("includes the message angle so the model writes consistent copy", () => {
    expect(buildBuyerOutreachPrompt(input({ topSignalType: "job_change" }))).toContain(
      "Message angle: relocation",
    );
    expect(
      buildBuyerOutreachPrompt(input({ topSignalType: "life_event_other" })),
    ).toContain("Message angle: life change");
  });

  it("EXPLICITLY forbids the seller-side 'I have buyers for your house' pitch (wrong audience)", () => {
    const p = buildBuyerOutreachPrompt(input());
    expect(p).toContain("Do NOT use phrases like 'I have buyers for your house'");
    expect(p).toMatch(/wrong audience/i);
  });

  it("forbids high-pressure phrasing", () => {
    const p = buildBuyerOutreachPrompt(input());
    expect(p).toMatch(/limited time/);
    expect(p).toMatch(/don't miss out/);
  });

  it("threads the agent display name into the sign-off instruction", () => {
    const p = buildBuyerOutreachPrompt(input({ agentDisplayName: "Casey" }));
    expect(p).toContain("Agent's name for sign-off: Casey");
  });

  it("propagates the strongest non-equity factor as the why-now line", () => {
    const p = buildBuyerOutreachPrompt(
      input({
        factors: [
          factor("equity_to_upgrade", 20, "Equity available for upgrade: $320,000 (40%)."),
          factor("buyer_intent_signals", 24, "Strongest buyer signal: job change (high)."),
        ],
      }),
    );
    expect(p).toContain("Strongest non-equity buyer signal today");
    expect(p).toContain("job change");
    // Equity line is its own context; not duplicated as "non-equity" hook
    expect(p.match(/non-equity buyer signal today/g)?.length ?? 0).toBe(1);
  });
});

describe("generateBuyerOutreachMessage — deterministic fallback (no OPENAI_API_KEY)", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  });

  it("returns aiPowered=false when key is missing", async () => {
    const out = await generateBuyerOutreachMessage(input());
    expect(out.aiPowered).toBe(false);
  });

  it("uses the contact's first name and the agent's name", async () => {
    const out = await generateBuyerOutreachMessage(input());
    expect(out.sms).toContain("Sarah");
    expect(out.sms).toContain("Alex");
    expect(out.emailBody).toContain("Sarah");
    expect(out.emailBody).toContain("Alex");
  });

  it("falls back to 'there' / 'your agent' when names are missing", async () => {
    const out = await generateBuyerOutreachMessage(
      input({ contactFirstName: null, contactFullName: "", agentDisplayName: null }),
    );
    expect(out.sms).toContain("there");
    expect(out.sms).toContain("your agent");
  });

  it("uses RELOCATION wording for job_change", async () => {
    const out = await generateBuyerOutreachMessage(input({ topSignalType: "job_change" }));
    expect(out.emailBody).toMatch(/relocat/i);
  });

  it("uses LIFE-CHANGE wording for life_event_other", async () => {
    const out = await generateBuyerOutreachMessage(
      input({ topSignalType: "life_event_other" }),
    );
    expect(out.emailBody).toMatch(/bigger family|smaller place|nudges the housing question/i);
  });

  it("uses EQUITY-UPGRADE wording when no signal but positive equity", async () => {
    const out = await generateBuyerOutreachMessage(
      input({
        topSignalType: null,
        closingPrice: 500_000,
        avmCurrent: 800_000,
        closingDate: "2020-01-01",
      }),
    );
    expect(out.sms).toMatch(/equity|move-up/i);
  });

  it("uses CASH-OUT MOVE wording for refi_detected", async () => {
    const out = await generateBuyerOutreachMessage(input({ topSignalType: "refi_detected" }));
    expect(out.emailBody).toMatch(/financing move/i);
  });

  it("uses GENERAL CHECK-IN when no signal and no equity", async () => {
    const out = await generateBuyerOutreachMessage(
      input({
        topSignalType: null,
        closingPrice: null,
        avmCurrent: null,
      }),
    );
    expect(out.sms).toMatch(/check-?in/i);
  });

  it("does NOT use seller-side 'I have buyers for your house' phrasing in any angle", async () => {
    const angles = [
      "job_change",
      "life_event_other",
      "refi_detected",
      "equity_milestone",
      null,
    ];
    for (const sig of angles) {
      const out = await generateBuyerOutreachMessage(input({ topSignalType: sig }));
      const all = `${out.sms}\n${out.emailSubject}\n${out.emailBody}`;
      expect(all, `signal=${sig}`).not.toMatch(/I have buyers for your house/i);
    }
  });

  it("never uses high-pressure phrases in any fallback angle", async () => {
    const angles = ["job_change", "life_event_other", "refi_detected", null];
    for (const sig of angles) {
      const out = await generateBuyerOutreachMessage(input({ topSignalType: sig }));
      const all = `${out.sms}\n${out.emailSubject}\n${out.emailBody}`;
      expect(all, `signal=${sig}`).not.toMatch(/limited time/i);
      expect(all, `signal=${sig}`).not.toMatch(/don't miss out/i);
      expect(all, `signal=${sig}`).not.toMatch(/act now/i);
    }
  });

  it("SMS is capped at 320 characters", async () => {
    const longAddr = "A very long street address ".repeat(20);
    const out = await generateBuyerOutreachMessage(input({ closingAddress: longAddr }));
    expect(out.sms.length).toBeLessThanOrEqual(320);
  });
});
