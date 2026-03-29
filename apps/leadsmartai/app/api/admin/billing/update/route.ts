import { NextResponse } from "next/server";
import { z } from "zod";
import {
  billingStatusToDb,
  estimatedMrrForPlan,
  subscriptionRowToBillingRecord,
  type BillingSubscriptionRow,
} from "@/lib/admin/billingRecords";
import { requireRoleRoute } from "@/lib/auth/requireRole";
import { supabaseAdmin } from "@/lib/supabase/admin";

const updateBillingSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["active", "trialing", "past_due", "canceled", "incomplete"]).optional(),
  plan: z
    .enum([
      "consumer_free",
      "consumer_premium",
      "agent_starter",
      "agent_pro",
      "loan_broker_pro",
    ])
    .optional(),
  cancel_at_period_end: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    const auth = await requireRoleRoute(["admin"], { strictUnauthorized: true });
    if (auth.ok === false) return auth.response;

    const body = await req.json();
    const parsed = updateBillingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id, status, plan, cancel_at_period_end } = parsed.data;

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status !== undefined) {
      updatePayload.status = billingStatusToDb(status);
    }
    if (plan !== undefined) {
      updatePayload.plan = plan;
      updatePayload.amount_monthly = estimatedMrrForPlan(plan);
    }
    if (cancel_at_period_end !== undefined) {
      updatePayload.cancel_at_period_end = cancel_at_period_end;
    }

    const hasFieldUpdates =
      status !== undefined || plan !== undefined || cancel_at_period_end !== undefined;

    if (!hasFieldUpdates) {
      return NextResponse.json(
        {
          success: false,
          error: "No updates",
          issues: "Provide at least one of status, plan, cancel_at_period_end",
        },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabaseAdmin
      .from("billing_subscriptions")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Billing record not found" },
        { status: 404 }
      );
    }

    const record = subscriptionRowToBillingRecord(updated as BillingSubscriptionRow);

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "Failed to update billing record" },
      { status: 500 }
    );
  }
}
