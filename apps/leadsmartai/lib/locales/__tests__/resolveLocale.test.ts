import { describe, expect, it } from "vitest";
import {
  resolveLeadOutboundLocale,
  resolveUiLocale,
} from "../resolveLocale";

describe("resolveLeadOutboundLocale", () => {
  it("returns the lead's preference when set to a known outbound-enabled locale", () => {
    expect(
      resolveLeadOutboundLocale({
        leadPreferredLanguage: "zh",
        agentDefaultOutboundLanguage: "en",
      }),
    ).toBe("zh");
  });

  it("falls through to agent default when lead has no preference", () => {
    expect(
      resolveLeadOutboundLocale({
        leadPreferredLanguage: null,
        agentDefaultOutboundLanguage: "zh",
      }),
    ).toBe("zh");
  });

  it("falls through to 'en' when neither lead nor agent has a known preference", () => {
    expect(
      resolveLeadOutboundLocale({
        leadPreferredLanguage: null,
        agentDefaultOutboundLanguage: null,
      }),
    ).toBe("en");
  });

  it("treats unknown locale strings as unset and falls through", () => {
    expect(
      resolveLeadOutboundLocale({
        leadPreferredLanguage: "klingon",
        agentDefaultOutboundLanguage: "zh",
      }),
    ).toBe("zh");
  });

  it("empty string on lead pref falls through to agent", () => {
    expect(
      resolveLeadOutboundLocale({
        leadPreferredLanguage: "",
        agentDefaultOutboundLanguage: "zh",
      }),
    ).toBe("zh");
  });

  it("respects an explicit lead pref of 'en' even when agent default is 'zh'", () => {
    // Scenario: bilingual agent whose default outbound is Chinese, but
    // this specific lead said "please English." The agent's default
    // shouldn't override a lead's stated preference.
    expect(
      resolveLeadOutboundLocale({
        leadPreferredLanguage: "en",
        agentDefaultOutboundLanguage: "zh",
      }),
    ).toBe("en");
  });

  it("falls through to 'en' when agent default is the legacy 'auto' value", () => {
    // agent_ai_settings.default_language can be 'auto'; the registry
    // doesn't know that value and we coerce to DEFAULT_LOCALE.
    expect(
      resolveLeadOutboundLocale({
        leadPreferredLanguage: null,
        agentDefaultOutboundLanguage: "auto",
      }),
    ).toBe("en");
  });
});

describe("resolveUiLocale", () => {
  it("returns 'en' when the user has no UI language set", () => {
    expect(resolveUiLocale({ userUiLanguage: null })).toBe("en");
    expect(resolveUiLocale({ userUiLanguage: undefined })).toBe("en");
  });

  it("falls back to 'en' for zh because ui.enabled is currently false", () => {
    // Chinese UI ships outbound-enabled but ui-disabled until catalog
    // coverage is 100%. This test pins that behavior so flipping the flag
    // on prematurely is a visible test breakage, not a silent surprise.
    expect(resolveUiLocale({ userUiLanguage: "zh" })).toBe("en");
  });

  it("coerces unknown strings to 'en'", () => {
    expect(resolveUiLocale({ userUiLanguage: "xx" })).toBe("en");
  });
});
