import { describe, expect, it } from "vitest";
import {
  expandHtmlTemplate,
  expandTextTemplate,
  extractTokens,
} from "../templating";

describe("expandTextTemplate", () => {
  it("substitutes built-in tokens", () => {
    const out = expandTextTemplate("Hi {{firstName}}!", {
      firstName: "Jane",
      lastName: "Smith",
    });
    expect(out).toBe("Hi Jane!");
  });

  it("composes fullName from firstName + lastName", () => {
    const out = expandTextTemplate("Dear {{fullName}},", {
      firstName: "Jane",
      lastName: "Smith",
    });
    expect(out).toBe("Dear Jane Smith,");
  });

  it("renders fullName with just one half when the other is missing", () => {
    expect(
      expandTextTemplate("{{fullName}}", { firstName: "Jane", lastName: null }),
    ).toBe("Jane");
    expect(
      expandTextTemplate("{{fullName}}", { firstName: null, lastName: "Smith" }),
    ).toBe("Smith");
  });

  it("renders unknown tokens as empty (not literal {{token}})", () => {
    const out = expandTextTemplate("Hi {{phoneNumber}}!", { firstName: "Jane" });
    expect(out).toBe("Hi !");
  });

  it("renders missing values as empty so a null first name doesn't leak template syntax", () => {
    const out = expandTextTemplate("Hi {{firstName}}!", { firstName: null });
    expect(out).toBe("Hi !");
  });

  it("is case-insensitive on token names", () => {
    const out = expandTextTemplate("{{FirstName}} {{LASTNAME}}", {
      firstName: "Jane",
      lastName: "Smith",
    });
    expect(out).toBe("Jane Smith");
  });

  it("handles whitespace inside the braces", () => {
    expect(expandTextTemplate("{{ firstName }}", { firstName: "Jane" })).toBe("Jane");
  });

  it("expands extras for caller-supplied tokens", () => {
    const out = expandTextTemplate(
      "Just listed: {{propertyAddress}}",
      { extras: { propertyAddress: "123 Main" } },
    );
    expect(out).toBe("Just listed: 123 Main");
  });
});

describe("expandHtmlTemplate", () => {
  it("HTML-escapes the substituted value to prevent injection", () => {
    const out = expandHtmlTemplate("<p>Hi {{firstName}}</p>", {
      firstName: '<script>alert("xss")</script>',
    });
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("does NOT escape the surrounding template HTML (agent-authored, trusted)", () => {
    const out = expandHtmlTemplate("<p>Hi <b>{{firstName}}</b></p>", {
      firstName: "Jane",
    });
    expect(out).toBe("<p>Hi <b>Jane</b></p>");
  });

  it("escapes ampersand and quotes in values", () => {
    const out = expandHtmlTemplate("{{firstName}}", { firstName: 'Jane & "Co"' });
    expect(out).toContain("&amp;");
    expect(out).toContain("&quot;");
  });
});

describe("extractTokens", () => {
  it("returns each unique token used", () => {
    const out = extractTokens(
      "Hi {{firstName}}, your address is {{propertyAddress}}. {{firstName}} again.",
    );
    expect(new Set(out)).toEqual(new Set(["firstName", "propertyAddress"]));
  });

  it("returns an empty array on no tokens", () => {
    expect(extractTokens("plain string")).toEqual([]);
  });
});
