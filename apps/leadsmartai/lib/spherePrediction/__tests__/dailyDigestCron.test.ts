import { describe, expect, it } from "vitest";

import {
  buildDigestSms,
  DIGEST_TOP_N,
  pickNewHighCandidates,
} from "@/lib/spherePrediction/digestFormat";
import type { LikelySellerRow } from "@/lib/spherePrediction/service";
import type { SphereSellerLabel } from "@/lib/spherePrediction/types";

function row(
  id: string,
  fullName: string,
  score: number,
  label: SphereSellerLabel,
  topReason = "Owned ~7y — peak sell window.",
): LikelySellerRow {
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

describe("pickNewHighCandidates", () => {
  it("filters to only label='high'", () => {
    const ranked = [
      row("a", "A", 85, "high"),
      row("b", "B", 60, "medium"),
      row("c", "C", 30, "low"),
    ];
    const out = pickNewHighCandidates(ranked, new Set());
    expect(out.map((r) => r.contactId)).toEqual(["a"]);
  });

  it("excludes contacts already notified within the dedup window", () => {
    const ranked = [
      row("a", "A", 85, "high"),
      row("b", "B", 80, "high"),
      row("c", "C", 75, "high"),
    ];
    const out = pickNewHighCandidates(ranked, new Set(["a", "c"]));
    expect(out.map((r) => r.contactId)).toEqual(["b"]);
  });

  it("preserves the input ranking order (caller already sorted desc)", () => {
    const ranked = [
      row("z", "Z", 95, "high"),
      row("y", "Y", 88, "high"),
      row("x", "X", 72, "high"),
    ];
    const out = pickNewHighCandidates(ranked, new Set());
    expect(out.map((r) => r.contactId)).toEqual(["z", "y", "x"]);
  });

  it("returns empty when nothing scores high", () => {
    const out = pickNewHighCandidates([row("a", "A", 50, "medium")], new Set());
    expect(out).toEqual([]);
  });

  it("returns empty when all highs are already notified", () => {
    const ranked = [row("a", "A", 90, "high"), row("b", "B", 80, "high")];
    const out = pickNewHighCandidates(ranked, new Set(["a", "b"]));
    expect(out).toEqual([]);
  });
});

describe("buildDigestSms", () => {
  it("returns null when there are no candidates", () => {
    expect(buildDigestSms([])).toBeNull();
  });

  it("uses singular phrasing for one candidate", () => {
    const out = buildDigestSms([row("a", "Sarah Chen", 85, "high")]);
    expect(out).toContain("1 likely seller");
    expect(out).not.toContain("1 likely sellers");
  });

  it("uses plural phrasing for multiple candidates", () => {
    const out = buildDigestSms([
      row("a", "A", 85, "high"),
      row("b", "B", 80, "high"),
    ]);
    expect(out).toContain("2 likely sellers");
  });

  it("greets the agent by first name when provided", () => {
    const out = buildDigestSms([row("a", "A", 85, "high")], "Alex");
    expect(out).toMatch(/^Alex,\s/);
  });

  it("omits the greeting when agent name is null/blank", () => {
    const blank = buildDigestSms([row("a", "A", 85, "high")], null);
    expect(blank).not.toMatch(/^null,/);
    expect(blank).toMatch(/^1 likely seller/);

    const ws = buildDigestSms([row("a", "A", 85, "high")], "   ");
    expect(ws).toMatch(/^1 likely seller/);
  });

  it("renders each candidate as a numbered line with score", () => {
    const out = buildDigestSms([
      row("a", "Sarah Chen", 85, "high", "Owned ~7y."),
      row("b", "Mike R", 78, "high", "Refi detected."),
    ]);
    expect(out).toContain("1. Sarah Chen (85)");
    expect(out).toContain("2. Mike R (78)");
    expect(out).toContain("Owned ~7y.");
    expect(out).toContain("Refi detected.");
  });

  it("caps at DIGEST_TOP_N candidates and adds '+N more'", () => {
    const candidates = Array.from({ length: DIGEST_TOP_N + 3 }, (_, i) =>
      row(`c${i}`, `Contact ${i}`, 90 - i, "high"),
    );
    const out = buildDigestSms(candidates);
    expect(out).toContain(`${DIGEST_TOP_N}. Contact ${DIGEST_TOP_N - 1}`);
    expect(out).not.toContain(`${DIGEST_TOP_N + 1}. Contact ${DIGEST_TOP_N}`);
    expect(out).toContain("+3 more on the dashboard");
  });

  it("does not add '+N more' when count is exactly DIGEST_TOP_N", () => {
    const candidates = Array.from({ length: DIGEST_TOP_N }, (_, i) =>
      row(`c${i}`, `Contact ${i}`, 90 - i, "high"),
    );
    const out = buildDigestSms(candidates);
    expect(out).not.toContain("more on the dashboard");
  });

  it("strips the '(AVM age Nd — discounted)' parenthetical from reasons (saves chars)", () => {
    const out = buildDigestSms([
      row("a", "A", 85, "high", "Equity $400,000 (40%) (AVM age 90d — discounted) since closing."),
    ]);
    expect(out).not.toContain("AVM age");
    expect(out).not.toContain("discounted");
    expect(out).toContain("$400,000");
  });

  it("truncates long reasons to ~70 chars with an ellipsis", () => {
    const longReason = "A very long top reason ".repeat(20);
    const out = buildDigestSms([row("a", "A", 85, "high", longReason)]);
    // Find the line for candidate "a" — it should be truncated.
    const line = out!.split("\n").find((l) => l.startsWith("1. A"));
    expect(line).toBeTruthy();
    expect(line!.length).toBeLessThan(110); // "1. A (85) — " + 70 + "…"
    expect(line).toContain("…");
  });

  it("includes the dashboard CTA tail", () => {
    const out = buildDigestSms([row("a", "A", 85, "high")]);
    expect(out).toMatch(/Open LeadSmart/i);
  });
});
