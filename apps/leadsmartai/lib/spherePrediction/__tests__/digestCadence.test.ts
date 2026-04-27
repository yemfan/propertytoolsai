import { describe, expect, it } from "vitest";

import {
  getCadenceForAgent,
  parseAgentIdSet,
  shouldRunDigestForAgentToday,
} from "@/lib/spherePrediction/digestCadence";

// 2026-04-26 is a Sunday (UTC). The Monday in this week is 2026-04-27.
const SUNDAY = new Date("2026-04-26T14:00:00Z");
const MONDAY = new Date("2026-04-27T14:00:00Z");
const TUESDAY = new Date("2026-04-28T14:00:00Z");

describe("parseAgentIdSet", () => {
  it("returns empty set for null/undefined/empty", () => {
    expect(parseAgentIdSet(null).size).toBe(0);
    expect(parseAgentIdSet(undefined).size).toBe(0);
    expect(parseAgentIdSet("").size).toBe(0);
  });

  it("parses comma-separated ids and trims whitespace", () => {
    const s = parseAgentIdSet("a, b , c");
    expect(s.has("a")).toBe(true);
    expect(s.has("b")).toBe(true);
    expect(s.has("c")).toBe(true);
    expect(s.size).toBe(3);
  });

  it("dedupes via Set semantics", () => {
    const s = parseAgentIdSet("a,b,a,c,b");
    expect(s.size).toBe(3);
  });

  it("ignores empty segments from stray commas", () => {
    expect(parseAgentIdSet(",a,,b,").size).toBe(2);
  });
});

describe("getCadenceForAgent", () => {
  it("returns 'daily' as the default when no env is set", () => {
    expect(getCadenceForAgent("agent-1", {})).toBe("daily");
  });

  it("returns 'weekly' when agent is in the weekly list only", () => {
    expect(
      getCadenceForAgent("agent-1", {
        SPHERE_DIGEST_WEEKLY_AGENT_IDS: "agent-1,agent-2",
      }),
    ).toBe("weekly");
  });

  it("returns 'off' when agent is in the off list only", () => {
    expect(
      getCadenceForAgent("agent-1", {
        SPHERE_DIGEST_OFF_AGENT_IDS: "agent-1",
      }),
    ).toBe("off");
  });

  it("'off' wins over 'weekly' when an agent is in both lists", () => {
    expect(
      getCadenceForAgent("agent-1", {
        SPHERE_DIGEST_WEEKLY_AGENT_IDS: "agent-1",
        SPHERE_DIGEST_OFF_AGENT_IDS: "agent-1",
      }),
    ).toBe("off");
  });

  it("isolates agents — only the queried id matters", () => {
    const env = {
      SPHERE_DIGEST_WEEKLY_AGENT_IDS: "agent-1",
      SPHERE_DIGEST_OFF_AGENT_IDS: "agent-2",
    };
    expect(getCadenceForAgent("agent-1", env)).toBe("weekly");
    expect(getCadenceForAgent("agent-2", env)).toBe("off");
    expect(getCadenceForAgent("agent-3", env)).toBe("daily");
  });
});

describe("shouldRunDigestForAgentToday", () => {
  it("daily agents always run, regardless of weekday", () => {
    for (const day of [SUNDAY, MONDAY, TUESDAY]) {
      expect(shouldRunDigestForAgentToday("agent-1", {}, day)).toBe(true);
    }
  });

  it("off agents never run, regardless of weekday", () => {
    const env = { SPHERE_DIGEST_OFF_AGENT_IDS: "agent-1" };
    for (const day of [SUNDAY, MONDAY, TUESDAY]) {
      expect(shouldRunDigestForAgentToday("agent-1", env, day)).toBe(false);
    }
  });

  it("weekly agents run on UTC Monday only", () => {
    const env = { SPHERE_DIGEST_WEEKLY_AGENT_IDS: "agent-1" };
    expect(shouldRunDigestForAgentToday("agent-1", env, SUNDAY)).toBe(false);
    expect(shouldRunDigestForAgentToday("agent-1", env, MONDAY)).toBe(true);
    expect(shouldRunDigestForAgentToday("agent-1", env, TUESDAY)).toBe(false);
  });

  it("uses UTC day-of-week (not local) — late Sunday in PT is still Sunday in UTC", () => {
    // 2026-04-26 23:30 PT = 2026-04-27 06:30 UTC (Monday). Verify we
    // honor the UTC reading because Vercel Cron schedules in UTC.
    const lateSunPtIsMondayUtc = new Date("2026-04-27T06:30:00Z");
    expect(lateSunPtIsMondayUtc.getUTCDay()).toBe(1); // sanity
    const env = { SPHERE_DIGEST_WEEKLY_AGENT_IDS: "agent-1" };
    expect(shouldRunDigestForAgentToday("agent-1", env, lateSunPtIsMondayUtc)).toBe(true);
  });

  it("'off' precedence still wins on a Monday", () => {
    const env = {
      SPHERE_DIGEST_WEEKLY_AGENT_IDS: "agent-1",
      SPHERE_DIGEST_OFF_AGENT_IDS: "agent-1",
    };
    expect(shouldRunDigestForAgentToday("agent-1", env, MONDAY)).toBe(false);
  });
});
