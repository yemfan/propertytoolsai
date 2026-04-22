import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET/PATCH /api/dashboard/settings/transaction-notifications
 *
 * Thin shim over `agent_notification_preferences` for the three
 * transaction-coordinator delivery toggles:
 *   - transaction_digest_enabled (kill-switch)
 *   - transaction_digest_frequency (daily / weekly / off)
 *   - wire_fraud_sms_enabled
 *
 * If no row exists yet, GET returns defaults (enabled=true, frequency=daily,
 * wire_sms=true) — the row gets created on first PATCH.
 */
export async function GET() {
  try {
    const { agentId } = await getCurrentAgentContext();
    const { data } = await supabaseAdmin
      .from("agent_notification_preferences")
      .select(
        "transaction_digest_enabled, transaction_digest_frequency, wire_fraud_sms_enabled, growth_digest_enabled",
      )
      .eq("agent_id", agentId)
      .maybeSingle();

    const row = data as {
      transaction_digest_enabled: boolean | null;
      transaction_digest_frequency: string | null;
      wire_fraud_sms_enabled: boolean | null;
      growth_digest_enabled: boolean | null;
    } | null;

    return NextResponse.json({
      ok: true,
      preferences: {
        transactionDigestEnabled: row?.transaction_digest_enabled ?? true,
        transactionDigestFrequency: row?.transaction_digest_frequency ?? "daily",
        wireFraudSmsEnabled: row?.wire_fraud_sms_enabled ?? true,
        growthDigestEnabled: row?.growth_digest_enabled ?? true,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

const ALLOWED_FREQ = new Set(["daily", "weekly", "off"]);

export async function PATCH(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json().catch(() => ({}))) as Partial<{
      transactionDigestEnabled: boolean;
      transactionDigestFrequency: string;
      wireFraudSmsEnabled: boolean;
      growthDigestEnabled: boolean;
    }>;

    const patch: Record<string, unknown> = {};
    if (typeof body.transactionDigestEnabled === "boolean") {
      patch.transaction_digest_enabled = body.transactionDigestEnabled;
    }
    if (typeof body.transactionDigestFrequency === "string") {
      if (!ALLOWED_FREQ.has(body.transactionDigestFrequency)) {
        return NextResponse.json(
          { ok: false, error: "Invalid frequency. Use daily, weekly, or off." },
          { status: 400 },
        );
      }
      patch.transaction_digest_frequency = body.transactionDigestFrequency;
    }
    if (typeof body.wireFraudSmsEnabled === "boolean") {
      patch.wire_fraud_sms_enabled = body.wireFraudSmsEnabled;
    }
    if (typeof body.growthDigestEnabled === "boolean") {
      patch.growth_digest_enabled = body.growthDigestEnabled;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "No fields to update." }, { status: 400 });
    }

    // Upsert so first-time changes don't 404.
    const { error } = await supabaseAdmin
      .from("agent_notification_preferences")
      .upsert(
        { agent_id: agentId, ...patch, updated_at: new Date().toISOString() },
        { onConflict: "agent_id" },
      );
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
