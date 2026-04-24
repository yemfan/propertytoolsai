import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { incrementUsage } from "./adminUsage";

/**
 * Charge one AI token against the user. Consumes the bonus wallet
 * first (atomic decrement), falling back to the monthly plan counter
 * only when bonus is exhausted. Mirrors the priority used by
 * `canUseAiAction` — if the check says "allowed because bonus",
 * consumption MUST come out of bonus, or the check and consume get
 * out of sync.
 *
 * Returns which wallet was charged, purely for telemetry/debugging.
 */
export async function consumeAiToken(
  userId: string,
): Promise<"bonus" | "monthly" | "skipped"> {
  // Read current bonus balance. If > 0, attempt a conditional
  // decrement: only succeeds if the balance is still > 0 at write
  // time — protects against a race where two concurrent consume
  // calls both see a positive balance.
  const { data } = await supabaseAdmin
    .from("leadsmart_users")
    .select("bonus_tokens")
    .eq("user_id", userId)
    .maybeSingle();
  const bonus = ((data as { bonus_tokens?: number } | null)?.bonus_tokens) ?? 0;

  if (bonus > 0) {
    const { data: updated, error } = await supabaseAdmin
      .from("leadsmart_users")
      .update({
        bonus_tokens: bonus - 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("bonus_tokens", bonus) // optimistic-concurrency guard
      .select("bonus_tokens")
      .maybeSingle();

    if (!error && updated) return "bonus";
    // If the optimistic update lost the race, fall through and
    // re-read. Either we'll charge monthly now, or the bonus was
    // already drained by the racing consume.
  }

  await incrementUsage(userId, "ai_actions_used");
  return "monthly";
}
