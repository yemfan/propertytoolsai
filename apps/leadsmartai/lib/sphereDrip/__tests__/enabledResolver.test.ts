import { describe, expect, it } from "vitest";

import {
  parseDripEnabledAgentIds,
  resolveDripEnabled,
} from "@/lib/sphereDrip/enabledResolver";

describe("parseDripEnabledAgentIds", () => {
  it("returns empty for null/undefined/blank", () => {
    expect(parseDripEnabledAgentIds(null)).toEqual([]);
    expect(parseDripEnabledAgentIds(undefined)).toEqual([]);
    expect(parseDripEnabledAgentIds("")).toEqual([]);
    expect(parseDripEnabledAgentIds("   ")).toEqual([]);
  });

  it("splits on commas + trims whitespace", () => {
    expect(parseDripEnabledAgentIds("a, b ,  c")).toEqual(["a", "b", "c"]);
  });

  it("dedupes preserving first-seen order", () => {
    expect(parseDripEnabledAgentIds("a,b,a,c,b")).toEqual(["a", "b", "c"]);
  });

  it("drops empty entries from runs of commas", () => {
    expect(parseDripEnabledAgentIds("a,,b,,, ,c")).toEqual(["a", "b", "c"]);
  });
});

describe("resolveDripEnabled — DB row present", () => {
  it("DB enabled=true → enabled, source='db'", () => {
    expect(
      resolveDripEnabled({ dbEnabled: true, envAllowlist: [], agentId: "a" }),
    ).toEqual({
      enabled: true,
      source: "db",
      hasDbRow: true,
      inEnvAllowlist: false,
    });
  });

  it("DB enabled=false wins over env=true (explicit opt-out)", () => {
    const out = resolveDripEnabled({
      dbEnabled: false,
      envAllowlist: ["a"],
      agentId: "a",
    });
    expect(out.enabled).toBe(false);
    expect(out.source).toBe("db");
    expect(out.inEnvAllowlist).toBe(true);
  });

  it("DB enabled=true with env=true → still enabled, source='db', inEnvAllowlist=true", () => {
    const out = resolveDripEnabled({
      dbEnabled: true,
      envAllowlist: ["a"],
      agentId: "a",
    });
    expect(out.enabled).toBe(true);
    expect(out.source).toBe("db");
    expect(out.inEnvAllowlist).toBe(true);
  });
});

describe("resolveDripEnabled — DB row absent", () => {
  it("env-only agent → enabled, source='env'", () => {
    expect(
      resolveDripEnabled({
        dbEnabled: undefined,
        envAllowlist: ["a"],
        agentId: "a",
      }),
    ).toEqual({
      enabled: true,
      source: "env",
      hasDbRow: false,
      inEnvAllowlist: true,
    });
  });

  it("not in env, no DB row → disabled, source='default'", () => {
    expect(
      resolveDripEnabled({
        dbEnabled: undefined,
        envAllowlist: ["other"],
        agentId: "a",
      }),
    ).toEqual({
      enabled: false,
      source: "default",
      hasDbRow: false,
      inEnvAllowlist: false,
    });
  });

  it("empty envAllowlist + no DB row → disabled default", () => {
    const out = resolveDripEnabled({
      dbEnabled: undefined,
      envAllowlist: [],
      agentId: "a",
    });
    expect(out.enabled).toBe(false);
    expect(out.source).toBe("default");
  });
});
