import { assertAiRateLimit, type RateLimitResult } from "@/lib/ai/rateLimit";
import { resolveUserPlanType } from "@/lib/ai/resolveUserPlan";

/**
 * Rate-limit middleware for LeadSmart AI (DB-backed, UTC day).
 * Call before invoking OpenAI (handlers already use this via gateAndGenerate).
 */
export async function enforceAiQuota(userId: string): Promise<RateLimitResult> {
  const planType = await resolveUserPlanType(userId);
  return assertAiRateLimit(userId, planType);
}
