import { describe, expect, it } from "vitest";
import {
  appendHtmlSignature,
  appendTextSignature,
  composeSignature,
  defaultSignatureHtml,
  defaultSignatureText,
  htmlToText,
  type AgentSignatureProfile,
} from "../compose";

const base: AgentSignatureProfile = {
  firstName: "Bob",
  lastName: "Rangier",
  email: "b.rangier@gmail.com",
  phone: "(281) 869-6717",
  brandName: "Bob Rangier Real Estate",
  brokerage: null,
  signatureHtml: null,
  agentPhotoUrl: null,
  logoUrl: null,
};

describe("composeSignature", () => {
  it("uses default template when signatureHtml is empty", () => {
    const r = composeSignature(base);
    expect(r.isCustom).toBe(false);
    expect(r.html).toContain("Bob Rangier");
    expect(r.html).toContain("b.rangier@gmail.com");
    expect(r.html).toContain("(281) 869-6717");
    expect(r.html).toContain("Bob Rangier Real Estate");
  });

  it("passes through custom signatureHtml when set", () => {
    const custom = "<p>My very cool signature</p>";
    const r = composeSignature({ ...base, signatureHtml: custom });
    expect(r.isCustom).toBe(true);
    expect(r.html).toBe(custom);
    expect(r.text).toBe("My very cool signature");
  });

  it("falls back to email prefix if no name set", () => {
    const r = composeSignature({
      ...base,
      firstName: null,
      lastName: null,
      fullName: null,
    });
    expect(r.html).toContain("b.rangier");
  });

  it("renders agent photo and logo when present", () => {
    const r = defaultSignatureHtml({
      ...base,
      agentPhotoUrl: "https://example.com/photo.jpg",
      logoUrl: "https://example.com/logo.png",
    });
    expect(r).toContain("photo.jpg");
    expect(r).toContain("border-radius:50%");
    expect(r).toContain("logo.png");
  });

  it("omits photo + logo tags when not set", () => {
    const r = defaultSignatureHtml(base);
    expect(r).not.toContain("<img");
  });

  it("escapes HTML in name/brand", () => {
    const r = defaultSignatureHtml({
      ...base,
      firstName: "<script>",
      brandName: "Rangier & Co.",
    });
    expect(r).not.toContain("<script>");
    expect(r).toContain("&lt;script&gt;");
    expect(r).toContain("Rangier &amp; Co.");
  });

  it("default text signature includes name + brand + contact", () => {
    const t = defaultSignatureText(base);
    expect(t).toContain("Bob Rangier");
    expect(t).toContain("Bob Rangier Real Estate");
    expect(t).toContain("b.rangier@gmail.com");
    expect(t).toContain("(281) 869-6717");
  });
});

describe("htmlToText", () => {
  it("converts breaks and block tags to newlines", () => {
    const t = htmlToText("<p>Line 1</p><br/><p>Line 2</p>");
    expect(t.split("\n").filter(Boolean)).toEqual(["Line 1", "Line 2"]);
  });

  it("decodes core entities", () => {
    expect(htmlToText("&amp; &lt; &gt; &quot; &#39;")).toBe("& < > \" '");
  });

  it("strips tag attributes", () => {
    expect(htmlToText('<div style="color:red">hi</div>')).toBe("hi");
  });
});

describe("appendSignature", () => {
  const sig = composeSignature(base);

  it("appends HTML signature before </body> when present", () => {
    const body = "<html><body><p>Hello</p></body></html>";
    const out = appendHtmlSignature(body, sig);
    expect(out).toContain("<p>Hello</p>");
    expect(out.indexOf("Bob Rangier")).toBeGreaterThan(out.indexOf("Hello"));
    expect(out.indexOf("</body>")).toBeGreaterThan(out.indexOf("Bob Rangier"));
  });

  it("appends HTML signature verbatim when no </body>", () => {
    const body = "<p>Hello</p>";
    const out = appendHtmlSignature(body, sig);
    expect(out).toContain("Bob Rangier");
  });

  it("appends text signature with separator", () => {
    const out = appendTextSignature("Hi there", sig);
    expect(out).toBe(`Hi there\n\n${sig.text}`);
  });

  it("skip=true leaves body untouched", () => {
    expect(appendHtmlSignature("<p>x</p>", sig, { skip: true })).toBe("<p>x</p>");
    expect(appendTextSignature("x", sig, { skip: true })).toBe("x");
  });
});
