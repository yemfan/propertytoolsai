import type { BillingPlanKey } from "@/lib/billingAccountPriceKeys";

export type BillingStatusApi =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete";

export type BillingRecordApi = {
  id: string;
  role: string;
  plan: BillingPlanKey;
  status: BillingStatusApi;
  amount_monthly: number;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  billing_provider: string;
};

const VALID_PLANS: BillingPlanKey[] = [
  "consumer_free",
  "consumer_premium",
  "agent_starter",
  "agent_pro",
  "loan_broker_pro",
];

function normalizePlan(raw: string | null | undefined): BillingPlanKey {
  const p = String(raw ?? "").trim();
  if (VALID_PLANS.includes(p as BillingPlanKey)) return p as BillingPlanKey;
  // Legacy `agents` / checkout metadata
  if (p === "free" || p === "") return "consumer_free";
  if (p === "premium") return "consumer_premium";
  if (p === "pro") return "agent_pro";
  return "consumer_free";
}

function normalizeStatus(raw: string | null | undefined): BillingStatusApi {
  const s = String(raw ?? "").toLowerCase().trim();
  if (
    s === "active" ||
    s === "trialing" ||
    s === "past_due" ||
    s === "canceled" ||
    s === "incomplete"
  ) {
    return s as BillingStatusApi;
  }
  if (s === "unpaid" || s === "paused") return "past_due";
  return "incomplete";
}

export function rowToBillingRecord(row: Record<string, unknown>): BillingRecordApi {
  const amount = row.amount_monthly;
  const num =
    typeof amount === "number"
      ? amount
      : typeof amount === "string"
        ? Number.parseFloat(amount)
        : 0;

  return {
    id: String(row.id ?? ""),
    role: String(row.role ?? "consumer"),
    plan: normalizePlan(row.plan != null ? String(row.plan) : null),
    status: normalizeStatus(row.status != null ? String(row.status) : null),
    amount_monthly: Number.isFinite(num) ? num : 0,
    current_period_start:
      row.current_period_start != null ? String(row.current_period_start) : null,
    current_period_end:
      row.current_period_end != null ? String(row.current_period_end) : null,
    cancel_at_period_end: Boolean(row.cancel_at_period_end),
    billing_provider: String(row.billing_provider ?? "stripe"),
  };
}
