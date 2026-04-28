import { describe, expect, it } from "vitest";

import { renderCmaEmail } from "@/lib/cma/emailTemplate";
import type { CmaSnapshot } from "@/lib/cma/types";

function snapshot(overrides: Partial<CmaSnapshot> = {}): CmaSnapshot {
  return {
    subject: {
      address: "10 Elm St, Austin",
      beds: 3,
      baths: 2,
      sqft: 1500,
      propertyType: "single_family",
      yearBuilt: 2000,
      condition: "good",
    },
    comps: [
      {
        address: "12 Elm St",
        price: 510_000,
        sqft: 1480,
        beds: 3,
        baths: 2,
        distanceMiles: 0.2,
        soldDate: "2026-03-15",
        propertyType: "single_family",
        pricePerSqft: 344,
      },
    ],
    valuation: {
      estimatedValue: 500_000,
      low: 470_000,
      high: 530_000,
      avgPricePerSqft: 333,
    },
    strategies: {
      aggressive: 480_000,
      market: 500_000,
      premium: 520_000,
      daysOnMarket: { aggressive: 5, market: 14, premium: 28 },
    },
    ...overrides,
  };
}

describe("renderCmaEmail — subject", () => {
  it("includes the subject address when present", () => {
    const out = renderCmaEmail({
      agentMessage: "",
      agentDisplayName: "Sam",
      sellerFirstName: "Alex",
      cmaTitle: "Title",
      snapshot: snapshot(),
    });
    expect(out.subject).toBe("Comparative Market Analysis — 10 Elm St, Austin");
  });

  it("falls back to cmaTitle when subject address is empty", () => {
    const out = renderCmaEmail({
      agentMessage: "",
      agentDisplayName: "Sam",
      sellerFirstName: "Alex",
      cmaTitle: "Smith family valuation",
      snapshot: snapshot({
        subject: { ...snapshot().subject, address: "" },
      }),
    });
    expect(out.subject).toContain("Smith family valuation");
  });
});

describe("renderCmaEmail — greeting", () => {
  it("uses the seller's first name when present", () => {
    const out = renderCmaEmail({
      agentMessage: "",
      agentDisplayName: "Sam",
      sellerFirstName: "Alex",
      cmaTitle: "x",
      snapshot: snapshot(),
    });
    expect(out.text.startsWith("Hi Alex,")).toBe(true);
    expect(out.html).toContain("Hi Alex,");
  });

  it("falls back to 'Hi there,' when seller's first name is missing", () => {
    const out = renderCmaEmail({
      agentMessage: "",
      agentDisplayName: "Sam",
      sellerFirstName: null,
      cmaTitle: "x",
      snapshot: snapshot(),
    });
    expect(out.text.startsWith("Hi there,")).toBe(true);
  });

  it("trims whitespace-only seller name to fallback", () => {
    const out = renderCmaEmail({
      agentMessage: "",
      agentDisplayName: "Sam",
      sellerFirstName: "   ",
      cmaTitle: "x",
      snapshot: snapshot(),
    });
    expect(out.text.startsWith("Hi there,")).toBe(true);
  });
});

describe("renderCmaEmail — cover note", () => {
  it("uses the agent's typed message when provided", () => {
    const out = renderCmaEmail({
      agentMessage: "Per our chat this morning — let me know your thoughts.",
      agentDisplayName: "Sam",
      sellerFirstName: "Alex",
      cmaTitle: "x",
      snapshot: snapshot(),
    });
    expect(out.text).toContain("Per our chat this morning");
    expect(out.html).toContain("Per our chat this morning");
  });

  it("falls back to a default note that includes the address when message is empty", () => {
    const out = renderCmaEmail({
      agentMessage: "",
      agentDisplayName: "Sam",
      sellerFirstName: "Alex",
      cmaTitle: "x",
      snapshot: snapshot(),
    });
    expect(out.text).toContain("10 Elm St, Austin");
  });

  it("falls back to 'your property' when subject address is also missing", () => {
    const out = renderCmaEmail({
      agentMessage: "",
      agentDisplayName: "Sam",
      sellerFirstName: "Alex",
      cmaTitle: "x",
      snapshot: snapshot({
        subject: { ...snapshot().subject, address: "" },
      }),
    });
    expect(out.text).toContain("your property");
  });
});

describe("renderCmaEmail — value range", () => {
  it("includes low / mid / high in the text body", () => {
    const out = renderCmaEmail({
      agentMessage: "",
      agentDisplayName: "Sam",
      sellerFirstName: "Alex",
      cmaTitle: "x",
      snapshot: snapshot(),
    });
    expect(out.text).toContain("$470,000");
    expect(out.text).toContain("$530,000");
    expect(out.text).toContain("$500,000");
  });

  it("includes the comp count line", () => {
    const out = renderCmaEmail({
      agentMessage: "",
      agentDisplayName: "Sam",
      sellerFirstName: "Alex",
      cmaTitle: "x",
      snapshot: snapshot(),
    });
    expect(out.text).toContain("1 comparable sale ");
  });

  it("pluralizes 'sales' when there are multiple comps", () => {
    const multi = snapshot();
    multi.comps = [...multi.comps, multi.comps[0]];
    const out = renderCmaEmail({
      agentMessage: "",
      agentDisplayName: "Sam",
      sellerFirstName: "Alex",
      cmaTitle: "x",
      snapshot: multi,
    });
    expect(out.text).toContain("2 comparable sales");
  });
});

describe("renderCmaEmail — listing strategies", () => {
  it("lists all three bands in the text body with prices and DOM", () => {
    const out = renderCmaEmail({
      agentMessage: "",
      agentDisplayName: "Sam",
      sellerFirstName: "Alex",
      cmaTitle: "x",
      snapshot: snapshot(),
    });
    expect(out.text).toContain("Aggressive");
    expect(out.text).toContain("$480,000");
    expect(out.text).toContain("~5 days");
    expect(out.text).toContain("Market");
    expect(out.text).toContain("$500,000");
    expect(out.text).toContain("Premium");
    expect(out.text).toContain("$520,000");
  });

  it("omits the DOM segment when the engine didn't return one", () => {
    const out = renderCmaEmail({
      agentMessage: "",
      agentDisplayName: "Sam",
      sellerFirstName: "Alex",
      cmaTitle: "x",
      snapshot: snapshot({ strategies: null }),
    });
    expect(out.text).not.toContain("days");
    expect(out.text).toContain("Aggressive");
  });
});

describe("renderCmaEmail — HTML safety", () => {
  it("escapes HTML special chars in the agent message", () => {
    const out = renderCmaEmail({
      agentMessage: "<script>alert('xss')</script>",
      agentDisplayName: "Sam",
      sellerFirstName: "Alex",
      cmaTitle: "x",
      snapshot: snapshot(),
    });
    expect(out.html).not.toContain("<script>");
    expect(out.html).toContain("&lt;script&gt;");
  });

  it("escapes HTML in agent display name", () => {
    const out = renderCmaEmail({
      agentMessage: "",
      agentDisplayName: "Sam <Pacific> & Co.",
      sellerFirstName: "Alex",
      cmaTitle: "x",
      snapshot: snapshot(),
    });
    expect(out.html).toContain("Sam &lt;Pacific&gt; &amp; Co.");
  });

  it("escapes HTML in seller first name", () => {
    const out = renderCmaEmail({
      agentMessage: "",
      agentDisplayName: "Sam",
      sellerFirstName: '"><script>x</script>',
      cmaTitle: "x",
      snapshot: snapshot(),
    });
    expect(out.html).not.toContain("<script>x</script>");
  });
});

describe("renderCmaEmail — sign-off", () => {
  it("includes the agent display name in the sign-off (text body)", () => {
    const out = renderCmaEmail({
      agentMessage: "",
      agentDisplayName: "Sam Reynolds",
      sellerFirstName: "Alex",
      cmaTitle: "x",
      snapshot: snapshot(),
    });
    expect(out.text).toContain("— Sam Reynolds");
  });
});
