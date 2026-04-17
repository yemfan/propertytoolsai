import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  DEFAULT_REVIEW_POLICY_BY_CATEGORY,
  type AgentMessageSettings,
  type AgentMessageSettingsEffective,
  type AgentMessageSettingsEffectiveRow,
  type AgentMessageSettingsRow,
  type ReviewPolicy,
  type ReviewPolicyByCategory,
} from "./types";

export const DEFAULT_AGENT_MESSAGE_SETTINGS: AgentMessageSettings = {
  reviewPolicy: "review",
  reviewPolicyByCategory: { ...DEFAULT_REVIEW_POLICY_BY_CATEGORY },
  quietHoursStart: "21:00",
  quietHoursEnd: "08:00",
  useContactTimezone: true,
  noSundayMorning: true,
  pauseChineseNewYear: true,
  maxPerContactPerDay: 2,
  pauseOnReplyDays: 7,
};

function mapRow(row: AgentMessageSettingsRow): AgentMessageSettings {
  const cat = row.review_policy_by_category ?? DEFAULT_REVIEW_POLICY_BY_CATEGORY;
  return {
    reviewPolicy: row.review_policy,
    reviewPolicyByCategory: {
      sphere: cat.sphere ?? "review",
      lead_response: cat.lead_response ?? "review",
    },
    quietHoursStart: (row.quiet_hours_start ?? "21:00").slice(0, 5),
    quietHoursEnd: (row.quiet_hours_end ?? "08:00").slice(0, 5),
    useContactTimezone: Boolean(row.use_contact_timezone),
    noSundayMorning: Boolean(row.no_sunday_morning),
    pauseChineseNewYear: Boolean(row.pause_chinese_new_year),
    maxPerContactPerDay: Number(row.max_per_contact_per_day ?? 2),
    pauseOnReplyDays: Number(row.pause_on_reply_days ?? 7),
  };
}

function mapEffectiveRow(row: AgentMessageSettingsEffectiveRow): AgentMessageSettingsEffective {
  const effCat = row.effective_review_policy_by_category ?? DEFAULT_REVIEW_POLICY_BY_CATEGORY;
  const storedCat = row.stored_review_policy_by_category ?? DEFAULT_REVIEW_POLICY_BY_CATEGORY;
  return {
    reviewPolicy: row.stored_review_policy,
    reviewPolicyByCategory: {
      sphere: storedCat.sphere ?? "review",
      lead_response: storedCat.lead_response ?? "review",
    },
    effectiveReviewPolicy: row.effective_review_policy,
    effectiveReviewPolicyByCategory: {
      sphere: effCat.sphere ?? "review",
      lead_response: effCat.lead_response ?? "review",
    },
    onboardingGateActive: Boolean(row.onboarding_gate_active),
    agentCreatedAt: row.agent_created_at,
    quietHoursStart: (row.quiet_hours_start ?? "21:00").slice(0, 5),
    quietHoursEnd: (row.quiet_hours_end ?? "08:00").slice(0, 5),
    useContactTimezone: Boolean(row.use_contact_timezone),
    noSundayMorning: Boolean(row.no_sunday_morning),
    pauseChineseNewYear: Boolean(row.pause_chinese_new_year),
    maxPerContactPerDay: Number(row.max_per_contact_per_day ?? 2),
    pauseOnReplyDays: Number(row.pause_on_reply_days ?? 7),
  };
}

/**
 * Load the stored settings. The UI reads this. For trigger scheduling, use
 * {@link getAgentMessageSettingsEffective} so the §2.4 onboarding gate applies.
 */
export async function getAgentMessageSettings(
  agentId: string | null | undefined,
): Promise<AgentMessageSettings> {
  if (!agentId) return { ...DEFAULT_AGENT_MESSAGE_SETTINGS };
  try {
    const { data, error } = await supabaseAdmin
      .from("agent_message_settings")
      .select("*")
      .eq("agent_id", agentId as never)
      .maybeSingle();
    if (error || !data) return { ...DEFAULT_AGENT_MESSAGE_SETTINGS };
    return mapRow(data as unknown as AgentMessageSettingsRow);
  } catch {
    return { ...DEFAULT_AGENT_MESSAGE_SETTINGS };
  }
}

/**
 * Load the *effective* settings with the §2.4 30-day onboarding gate forced in.
 * Read this from the trigger scheduler; never the raw table.
 */
export async function getAgentMessageSettingsEffective(
  agentId: string | null | undefined,
): Promise<AgentMessageSettingsEffective | null> {
  if (!agentId) return null;
  try {
    const { data, error } = await supabaseAdmin
      .from("agent_message_settings_effective")
      .select("*")
      .eq("agent_id", agentId as never)
      .maybeSingle();
    if (error || !data) return null;
    return mapEffectiveRow(data as unknown as AgentMessageSettingsEffectiveRow);
  } catch {
    return null;
  }
}

export type UpsertAgentMessageSettingsInput = Partial<AgentMessageSettings>;

function clampTime(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const m = v.match(/^(\d{2}):(\d{2})$/);
  if (!m) return undefined;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return undefined;
  return `${m[1]}:${m[2]}`;
}

function clampInt(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return undefined;
  const i = Math.round(n);
  if (i < min || i > max) return undefined;
  return i;
}

function parseReviewPolicy(v: unknown): ReviewPolicy | undefined {
  return v === "review" || v === "autosend" || v === "per_category" ? v : undefined;
}

function parseReviewPolicyByCategory(
  v: unknown,
): ReviewPolicyByCategory | undefined {
  if (!v || typeof v !== "object") return undefined;
  const raw = v as Record<string, unknown>;
  const s = raw.sphere;
  const lr = raw.lead_response;
  const ok = (x: unknown): x is "review" | "autosend" => x === "review" || x === "autosend";
  if (!ok(s) || !ok(lr)) return undefined;
  return { sphere: s, lead_response: lr };
}

export async function upsertAgentMessageSettings(
  agentId: string,
  input: UpsertAgentMessageSettingsInput,
): Promise<AgentMessageSettings> {
  const current = await getAgentMessageSettings(agentId);

  // Spec §2.4: backend gate. If the agent is in the first 30 days, reject
  // autosend writes — the effective view would ignore them anyway, but we
  // refuse the write so it's visible to the user.
  const next: AgentMessageSettings = {
    reviewPolicy: input.reviewPolicy ?? current.reviewPolicy,
    reviewPolicyByCategory: input.reviewPolicyByCategory ?? current.reviewPolicyByCategory,
    quietHoursStart: input.quietHoursStart ?? current.quietHoursStart,
    quietHoursEnd: input.quietHoursEnd ?? current.quietHoursEnd,
    useContactTimezone: input.useContactTimezone ?? current.useContactTimezone,
    noSundayMorning: input.noSundayMorning ?? current.noSundayMorning,
    pauseChineseNewYear: input.pauseChineseNewYear ?? current.pauseChineseNewYear,
    maxPerContactPerDay: input.maxPerContactPerDay ?? current.maxPerContactPerDay,
    pauseOnReplyDays: input.pauseOnReplyDays ?? current.pauseOnReplyDays,
  };

  const onboardingGateActive = await isOnboardingGateActive(agentId);
  if (onboardingGateActive) {
    if (next.reviewPolicy === "autosend") {
      throw new Error("Autosend is locked until day 31 of your account (spec §2.4).");
    }
    if (next.reviewPolicy === "per_category") {
      // Force per-category values to review during the gate, but allow the
      // policy selection itself so the UI doesn't snap back.
      next.reviewPolicyByCategory = {
        sphere: "review",
        lead_response: "review",
      };
    }
  }

  const { error } = await supabaseAdmin.from("agent_message_settings").upsert(
    {
      agent_id: agentId as never,
      review_policy: next.reviewPolicy,
      review_policy_by_category: next.reviewPolicyByCategory,
      quiet_hours_start: next.quietHoursStart,
      quiet_hours_end: next.quietHoursEnd,
      use_contact_timezone: next.useContactTimezone,
      no_sunday_morning: next.noSundayMorning,
      pause_chinese_new_year: next.pauseChineseNewYear,
      max_per_contact_per_day: next.maxPerContactPerDay,
      pause_on_reply_days: next.pauseOnReplyDays,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "agent_id" },
  );
  if (error) throw error;
  return next;
}

async function isOnboardingGateActive(agentId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("agents")
    .select("created_at")
    .eq("id", agentId as never)
    .maybeSingle();
  if (error || !data) return true; // fail-closed: gate remains active
  const createdAt = (data as { created_at?: string | null }).created_at;
  if (!createdAt) return true;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return true;
  return Date.now() - created < 30 * 24 * 60 * 60 * 1000;
}

/**
 * Shape-and-clamp request body into a valid partial input. Returns undefined
 * for anything outside bounds — callers filter those out.
 */
export function parseUpsertBody(body: Record<string, unknown>): UpsertAgentMessageSettingsInput {
  const out: UpsertAgentMessageSettingsInput = {};
  if ("reviewPolicy" in body) {
    const v = parseReviewPolicy(body.reviewPolicy);
    if (v) out.reviewPolicy = v;
  }
  if ("reviewPolicyByCategory" in body) {
    const v = parseReviewPolicyByCategory(body.reviewPolicyByCategory);
    if (v) out.reviewPolicyByCategory = v;
  }
  if ("quietHoursStart" in body) {
    const v = clampTime(body.quietHoursStart);
    if (v) out.quietHoursStart = v;
  }
  if ("quietHoursEnd" in body) {
    const v = clampTime(body.quietHoursEnd);
    if (v) out.quietHoursEnd = v;
  }
  for (const k of ["useContactTimezone", "noSundayMorning", "pauseChineseNewYear"] as const) {
    if (k in body && typeof body[k] === "boolean") out[k] = body[k] as boolean;
  }
  if ("maxPerContactPerDay" in body) {
    const v = clampInt(body.maxPerContactPerDay, 1, 5);
    if (v !== undefined) out.maxPerContactPerDay = v;
  }
  if ("pauseOnReplyDays" in body) {
    const v = clampInt(body.pauseOnReplyDays, 0, 30);
    if (v !== undefined) out.pauseOnReplyDays = v;
  }
  return out;
}

export { isOnboardingGateActive };
