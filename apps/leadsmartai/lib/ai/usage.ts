import { supabaseServer } from "@/lib/supabaseServer";

/** Rough token estimate when API does not return usage (chars/4 heuristic). */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(String(text).length / 4));
}

export async function logAiUsage(input: {
  userId: string;
  tool: string;
  tokensUsed: number;
}): Promise<void> {
  const { error } = await supabaseServer.from("ai_usage").insert({
    user_id: input.userId,
    tool: input.tool,
    tokens_used: Math.max(0, Math.floor(input.tokensUsed)),
  } as any);

  if (error) {
    console.error("[LeadSmart AI] ai_usage insert error", error.message);
  }
}

export async function countAiUsageTodayUtc(userId: string): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { count, error } = await supabaseServer
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString())
    // Cache hits should not consume daily AI quota.
    .not("tool", "like", "%cache_hit%");

  if (error) {
    console.error("[LeadSmart AI] ai_usage count error", error.message);
    return 0;
  }
  return count ?? 0;
}
