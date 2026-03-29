export const PLAN_LIMITS: Record<string, number> = {
  free: 20,
  pro: 200,
  elite: Number.POSITIVE_INFINITY,
};

export function getLeadLimit(planType: string): number {
  return PLAN_LIMITS[planType] ?? PLAN_LIMITS.free;
}

