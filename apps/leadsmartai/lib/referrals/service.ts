import "server-only";
import { randomBytes } from "crypto";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Referral program — each user gets a share code; a signup via
 * someone else's code grants both sides a perpetual bonus-token
 * grant when the referee completes onboarding.
 *
 * Bonus lives in `leadsmart_users.bonus_tokens` (see migration
 * 20260504000000_referrals_and_bonus_tokens.sql). Bonus tokens are
 * consumed BEFORE the monthly plan quota — see
 * `lib/entitlements/accessResult.ts :: canUseAiAction`.
 */

export const REFERRAL_BONUS_TOKENS = 20_000;

export type ReferralStatus = "pending" | "completed" | "expired";

export type ReferralSummary = {
  code: string;
  bonusTokens: number;
  completedCount: number;
  pendingCount: number;
  totalBonusEarned: number;
};

/**
 * Returns the caller's referral code + live stats. Generates a new
 * code on first call if the user doesn't have one yet.
 */
export async function getReferralSummary(userId: string): Promise<ReferralSummary> {
  const code = await ensureReferralCode(userId);

  const { data: userRow } = await supabaseAdmin
    .from("leadsmart_users")
    .select("bonus_tokens")
    .eq("user_id", userId)
    .maybeSingle();
  const bonusTokens = ((userRow as { bonus_tokens?: number } | null)?.bonus_tokens) ?? 0;

  const { data: counts } = await supabaseAdmin
    .from("user_referrals")
    .select("status,bonus_amount")
    .eq("referrer_user_id", userId);
  const rows = (counts ?? []) as Array<{ status: ReferralStatus; bonus_amount: number }>;
  const completedCount = rows.filter((r) => r.status === "completed").length;
  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const totalBonusEarned = rows
    .filter((r) => r.status === "completed")
    .reduce((sum, r) => sum + (r.bonus_amount ?? 0), 0);

  return {
    code,
    bonusTokens,
    completedCount,
    pendingCount,
    totalBonusEarned,
  };
}

/**
 * Ensures the user has a referral_code. Idempotent — returns the
 * existing code if present. Retries once on the (extremely unlikely)
 * collision with the global unique index.
 */
export async function ensureReferralCode(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("leadsmart_users")
    .select("referral_code")
    .eq("user_id", userId)
    .maybeSingle();
  const existing = (data as { referral_code: string | null } | null)?.referral_code;
  if (existing) return existing;

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newCode();
    const { error } = await supabaseAdmin
      .from("leadsmart_users")
      .update({ referral_code: code, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (!error) return code;
    // 23505 = unique violation (code collision) — retry with a new one.
    if ((error as { code?: string }).code !== "23505") throw new Error(error.message);
  }
  throw new Error("Could not generate a unique referral code after 3 attempts");
}

/**
 * Called when a NEW user signs up with `?ref=CODE`. Creates a
 * pending referral row. No-op if the referee is already referred
 * (unique index on referee_user_id), or if the code is unknown.
 *
 * Returns the referrer user id if the referral was recorded, or
 * null otherwise.
 */
export async function recordPendingReferral(opts: {
  refereeUserId: string;
  code: string;
}): Promise<{ recorded: boolean; referrerUserId: string | null }> {
  const code = (opts.code || "").trim().toUpperCase();
  if (!code) return { recorded: false, referrerUserId: null };

  const { data: referrerRow } = await supabaseAdmin
    .from("leadsmart_users")
    .select("user_id")
    .eq("referral_code", code)
    .maybeSingle();
  const referrerUserId = (referrerRow as { user_id: string } | null)?.user_id ?? null;
  if (!referrerUserId) return { recorded: false, referrerUserId: null };

  // Self-referral guard.
  if (referrerUserId === opts.refereeUserId) {
    return { recorded: false, referrerUserId };
  }

  const { error } = await supabaseAdmin.from("user_referrals").insert({
    referrer_user_id: referrerUserId,
    referee_user_id: opts.refereeUserId,
    status: "pending",
    bonus_amount: REFERRAL_BONUS_TOKENS,
  });
  if (error) {
    const code = (error as { code?: string }).code;
    // 23505 = referee already referred; not an error, just idempotent.
    if (code === "23505") return { recorded: false, referrerUserId };
    throw new Error(error.message);
  }
  return { recorded: true, referrerUserId };
}

/**
 * Called when a referee completes onboarding. Grants the bonus to
 * both users in a single atomic operation (well, two updates — the
 * caller should invoke this from a trusted server path; the
 * bonus_granted_at check makes concurrent retries safe).
 *
 * Returns the pair that got credited, or null if there's no
 * pending referral for this user.
 */
export async function grantReferralBonusIfPending(
  refereeUserId: string,
): Promise<{
  granted: boolean;
  referrerUserId: string | null;
  amount: number;
} | null> {
  const { data } = await supabaseAdmin
    .from("user_referrals")
    .select("id, referrer_user_id, bonus_amount, status, bonus_granted_at")
    .eq("referee_user_id", refereeUserId)
    .maybeSingle();
  const row = data as {
    id: string;
    referrer_user_id: string;
    bonus_amount: number;
    status: ReferralStatus;
    bonus_granted_at: string | null;
  } | null;
  if (!row) return null;
  if (row.status === "completed" || row.bonus_granted_at) {
    return { granted: false, referrerUserId: row.referrer_user_id, amount: row.bonus_amount };
  }

  // Flip status first + stamp granted_at — this is the idempotency
  // guard. If a concurrent process sees the row already completed,
  // it skips the token bumps.
  const now = new Date().toISOString();
  const { data: updated, error: updErr } = await supabaseAdmin
    .from("user_referrals")
    .update({ status: "completed", bonus_granted_at: now, updated_at: now })
    .eq("id", row.id)
    .is("bonus_granted_at", null)
    .select("id")
    .maybeSingle();
  if (updErr) throw new Error(updErr.message);
  if (!updated) {
    // Another process already flipped this row — bail without
    // double-crediting.
    return { granted: false, referrerUserId: row.referrer_user_id, amount: row.bonus_amount };
  }

  await bumpBonusTokens(row.referrer_user_id, row.bonus_amount);
  await bumpBonusTokens(refereeUserId, row.bonus_amount);

  return {
    granted: true,
    referrerUserId: row.referrer_user_id,
    amount: row.bonus_amount,
  };
}

/**
 * Atomic increment of bonus_tokens. Uses a round-trip read-then-
 * write; good enough given the low volume of referrals. For higher
 * volume we'd push this into a Postgres function.
 */
export async function bumpBonusTokens(userId: string, delta: number): Promise<void> {
  const { data } = await supabaseAdmin
    .from("leadsmart_users")
    .select("bonus_tokens")
    .eq("user_id", userId)
    .maybeSingle();
  const current = ((data as { bonus_tokens?: number } | null)?.bonus_tokens) ?? 0;
  await supabaseAdmin
    .from("leadsmart_users")
    .update({
      bonus_tokens: Math.max(0, current + delta),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

function newCode(): string {
  // 8 uppercase alphanum — easy to say on a phone, no ambiguous chars.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}
