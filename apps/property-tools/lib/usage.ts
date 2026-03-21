/**
 * Usage tracking: server-backed for logged-in users (Supabase RPC),
 * local daily counters for guests (localStorage).
 */

import { supabaseBrowser } from "@/lib/supabaseBrowser";
import type { AccessTier } from "@/lib/access";

const GUEST_STORAGE_KEY = "propertytoolsai:guest_tool_usage:v1";

export type ToolUsageEntry = {
  used: number;
  limit: number | null;
  period: "daily" | "monthly";
  remaining: number | null;
};

export type AccessUsageState = {
  ok: boolean;
  tier: AccessTier;
  plan: string | null;
  subscriptionStatus: string | null;
  userId: string | null;
  /** Per-tool snapshot; limits may come from server + defaults */
  tools: Record<string, ToolUsageEntry>;
  /** Server epoch / ISO hints for UI */
  usageResetDate?: string | null;
};

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

type GuestBucket = Record<string, { count: number; day: string }>;

function readGuestRaw(): GuestBucket {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as GuestBucket;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeGuestRaw(data: GuestBucket) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

/** Guest-only: increment a daily counter; returns new used count. */
export function incrementGuestUsage(tool: string): { used: number; day: string } {
  const day = todayUtcDate();
  const key = tool.trim().toLowerCase() || "default";
  const all = readGuestRaw();
  const cur = all[key];
  const count = cur?.day === day ? (cur?.count ?? 0) + 1 : 1;
  all[key] = { count, day };
  writeGuestRaw(all);
  return { used: count, day };
}

export function getGuestUsage(tool: string): number {
  const day = todayUtcDate();
  const key = tool.trim().toLowerCase() || "default";
  const cur = readGuestRaw()[key];
  if (!cur || cur.day !== day) return 0;
  return Number(cur.count) || 0;
}

/**
 * Fetch unified usage + tier from API (cookies). Works in browser only.
 * For guests, merges localStorage daily counters into `tools.*.used`.
 */
export async function getUsage(): Promise<AccessUsageState> {
  const res = await fetch("/api/access/usage", {
    credentials: "include",
    cache: "no-store",
  });
  const json = (await res.json()) as AccessUsageState & { ok?: boolean; error?: string };
  if (!res.ok || json.ok === false) {
    throw new Error(json.error ?? "Failed to load usage");
  }

  if (json.tier === "guest" && typeof window !== "undefined") {
    const tools = { ...json.tools };
    for (const key of Object.keys(tools)) {
      const used = getGuestUsage(key);
      const entry = tools[key];
      const limit = entry?.limit ?? null;
      tools[key] = {
        ...entry,
        used,
        remaining: limit === null ? null : Math.max(0, limit - used),
      };
    }
    return { ...json, tools };
  }

  return json;
}

export type IncrementUsageResult = {
  ok: boolean;
  tool: string;
  used?: number | null;
  limit?: number | null;
  tier?: AccessTier;
  error?: string;
  status?: number;
};

/**
 * Increment usage for a tool. Logged-in users hit Supabase RPC when tool maps to cma/estimator.
 * Guests use localStorage daily buckets for generic tools.
 */
export async function incrementUsage(tool: string): Promise<IncrementUsageResult> {
  const t = tool.trim().toLowerCase();
  const supabase = supabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    incrementGuestUsage(t);
    return { ok: true, tool: t, tier: "guest" };
  }

  const rpc =
    t === "cma" || t === "smart_cma" || t === "cma_report"
      ? "cma"
      : t === "estimator" || t === "home_value" || t === "home-value"
        ? "estimator"
        : null;

  if (!rpc) {
    return { ok: true, tool: t, tier: "free" };
  }

  const res = await fetch("/api/usage/increment", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool: rpc }),
  });

  const json = (await res.json().catch(() => ({}))) as IncrementUsageResult;

  if (!res.ok) {
    return {
      ok: false,
      tool: t,
      error: json.error ?? "Usage increment failed",
      status: res.status,
    };
  }

  return { ok: true, tool: t, used: json.used ?? null, limit: json.limit ?? null };
}
