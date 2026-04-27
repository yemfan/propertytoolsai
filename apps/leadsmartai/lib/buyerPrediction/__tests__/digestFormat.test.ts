import { describe, expect, it } from "vitest";

import {
  buildBuyerDigestSms,
  BUYER_DIGEST_TOP_N,
  pickNewHighBuyerCandidates,
} from "@/lib/buyerPrediction/digestFormat";
import type { LikelyBuyerRow } from "@/lib/buyerPrediction/service";
import type { BuyerPredictionLabel } from "@/lib/buyerPrediction/types";

function row(
  id: string,
  fullName: string,
  score: number,
  label: BuyerPredictionLabel,
  topReason = "Strongest buyer signal: job change (high).",
): LikelyBuyerRow {
  return {
    contactId: id,
    fullName,
    email: null,
    phone: null,
    lifecycleStage: "past_client",
    closingAddress: null,
    closingDate: null,
    score,
    label,
    topReason,
    factors: [],
  };
}

describe("pickNewHighBuyerCandidates", () => {
  it("filters to only label='high'", () => {
    const ranked = [
      row("a", "A", 85, "high"),
      row("b", "B", 60, "medium"),
      row("c", "C", 30, "low"),
    ];
    expect(pickNewHighBuyerCandidates(ranked, new Set()).map((r) => r.contactId)).toEqual(["a"]);
  });

  it("excludes contacts already notified within the dedup window", () => {
    const ranked = [
      row("a", "A", 85, "high"),
      row("b", "B", 80, "high"),
      row("c", "C", 75, "high"),
    ];
    expect(
      pickNewHighBuyerCandidates(ranked, new Set(["a", "c"])).map((r) => r.contactId),
    ).toEqual(["b"]);
  });

  it("preserves the input ranking order", () => {
    const ranked = [
      row("z", "Z", 95, "high"),
      row("y", "Y", 88, "high"),
    ];
    expect(pickNewHighBuyerCandidates(ranked, new Set()).map((r) => r.contactId)).toEqual([
      "z",
      "y",
    ]);
  });

  it("returns empty when nothing scores high", () => {
    expect(pickNewHighBuyerCandidates([row("a", "A", 50, "medium")], new Set())).toEqual([]);
  });
});

describe("buildBuyerDigestSms", () => {
  it("returns null when there are no candidates", () => {
    expect(buildBuyerDigestSms([])).toBeNull();
  });

  it("uses singular phrasing for one candidate", () => {
    const out = buildBuyerDigestSms([row("a", "Sarah Chen", 85, "high")]);
    expect(out).toContain("1 contact likely to buy");
    expect(out).not.toContain("1 contacts");
  });

  it("uses plural phrasing for multiple candidates", () => {
    const out = buildBuyerDigestSms([
      row("a", "A", 85, "high"),
      row("b", "B", 80, "high"),
    ]);
    expect(out).toContain("2 contacts likely to buy");
  });

  it("greets the agent by first name when provided", () => {
    const out = buildBuyerDigestSms([row("a", "A", 85, "high")], "Alex");
    expect(out).toMatch(/^Alex,\s/);
  });

  it("omits the greeting when agent name is null/whitespace", () => {
    const blank = buildBuyerDigestSms([row("a", "A", 85, "high")], null);
    expect(blank).toMatch(/^1 contact likely to buy/);

    const ws = buildBuyerDigestSms([row("a", "A", 85, "high")], "   ");
    expect(ws).toMatch(/^1 contact likely to buy/);
  });

  it("renders each candidate as a numbered line with score", () => {
    const out = buildBuyerDigestSms([
      row("a", "Sarah Chen", 85, "high", "Strongest buyer signal: job change (high)."),
      row("b", "Mike R", 78, "high", "Strongest buyer signal: life event (medium)."),
    ]);
    expect(out).toContain("1. Sarah Chen (85)");
    expect(out).toContain("2. Mike R (78)");
    expect(out).toContain("job change");
    expect(out).toContain("life event");
  });

  it("caps at BUYER_DIGEST_TOP_N candidates and adds '+N more'", () => {
    const candidates = Array.from({ length: BUYER_DIGEST_TOP_N + 3 }, (_, i) =>
      row(`c${i}`, `Contact ${i}`, 90 - i, "high"),
    );
    const out = buildBuyerDigestSms(candidates);
    expect(out).toContain(`${BUYER_DIGEST_TOP_N}. Contact ${BUYER_DIGEST_TOP_N - 1}`);
    expect(out).not.toContain(`${BUYER_DIGEST_TOP_N + 1}. Contact ${BUYER_DIGEST_TOP_N}`);
    expect(out).toContain("+3 more on the dashboard");
  });

  it("does not add '+N more' when count is exactly BUYER_DIGEST_TOP_N", () => {
    const candidates = Array.from({ length: BUYER_DIGEST_TOP_N }, (_, i) =>
      row(`c${i}`, `Contact ${i}`, 90 - i, "high"),
    );
    const out = buildBuyerDigestSms(candidates);
    expect(out).not.toContain("more on the dashboard");
  });

  it("strips the AVM-age parenthetical to save SMS chars", () => {
    const out = buildBuyerDigestSms([
      row(
        "a",
        "A",
        85,
        "high",
        "Equity available for upgrade: $400,000 (40%) (AVM age 90d — discounted).",
      ),
    ]);
    expect(out).not.toContain("AVM age");
    expect(out).not.toContain("discounted");
    expect(out).toContain("$400,000");
  });

  it("truncates long reasons to ~70 chars with an ellipsis", () => {
    const longReason = "A very long top reason ".repeat(20);
    const out = buildBuyerDigestSms([row("a", "A", 85, "high", longReason)]);
    const line = out!.split("\n").find((l) => l.startsWith("1. A"));
    expect(line).toBeTruthy();
    expect(line!.length).toBeLessThan(110); // "1. A (85) — " + 70 + "…"
    expect(line).toContain("…");
  });

  it("includes the buyer-specific 'AI outreach' tail (not seller's 'AI messages')", () => {
    const out = buildBuyerDigestSms([row("a", "A", 85, "high")]);
    expect(out).toMatch(/AI outreach/i);
    // Locks the divergence from the seller digest's tail.
    expect(out).not.toMatch(/AI messages/i);
  });
});
