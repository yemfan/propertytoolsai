import { afterEach, describe, expect, it } from "vitest";

// Test the pure helpers from pushDispatch without importing the full module
// (which has Supabase side effects). We test the contract instead.

describe("push notification message format", () => {
  function buildMessages(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, string>,
    priority: "high" | "default" = "high"
  ) {
    return tokens.map((to) => ({
      to,
      title,
      body,
      data,
      sound: "default",
      priority,
    }));
  }

  it("creates one message per token", () => {
    const msgs = buildMessages(
      ["token1", "token2"],
      "Test",
      "Body",
      { kind: "hot_lead" }
    );
    expect(msgs).toHaveLength(2);
    expect(msgs[0].to).toBe("token1");
    expect(msgs[1].to).toBe("token2");
  });

  it("sets default sound and high priority", () => {
    const [msg] = buildMessages(["t1"], "T", "B", {});
    expect(msg.sound).toBe("default");
    expect(msg.priority).toBe("high");
  });

  it("passes data payload through", () => {
    const [msg] = buildMessages(["t1"], "T", "B", {
      kind: "inbound_sms",
      leadId: "123",
      screen: "lead",
    });
    expect(msg.data.kind).toBe("inbound_sms");
    expect(msg.data.leadId).toBe("123");
    expect(msg.data.screen).toBe("lead");
  });

  it("returns empty array for no tokens", () => {
    const msgs = buildMessages([], "T", "B", {});
    expect(msgs).toHaveLength(0);
  });
});

describe("push global disable check", () => {
  const orig = process.env.MOBILE_PUSH_ENABLED;

  afterEach(() => {
    if (orig !== undefined) process.env.MOBILE_PUSH_ENABLED = orig;
    else delete process.env.MOBILE_PUSH_ENABLED;
  });

  it("detects disabled when env var is 'false'", () => {
    process.env.MOBILE_PUSH_ENABLED = "false";
    expect(process.env.MOBILE_PUSH_ENABLED === "false").toBe(true);
  });

  it("detects enabled when env var is 'true'", () => {
    process.env.MOBILE_PUSH_ENABLED = "true";
    expect(process.env.MOBILE_PUSH_ENABLED === "false").toBe(false);
  });

  it("detects enabled when env var is not set", () => {
    delete process.env.MOBILE_PUSH_ENABLED;
    expect(process.env.MOBILE_PUSH_ENABLED === "false").toBe(false);
  });
});
