import { NextResponse } from "next/server";

import { subscriptionRequiredResponse, userHasCrmFeature } from "@/lib/billing/subscriptionAccess";
import { isSendEquityFailure, sendEquityMessage } from "@/lib/spherePrediction/sendEquityMessage";
import { supabaseServerClient } from "@/lib/supabaseServerClient";

export const runtime = "nodejs";

/**
 * POST — actually send the SOI equity-update message after the agent
 * reviewed and edited the AI draft.
 *
 * Body: { channel: "sms" | "email", body: string, emailSubject?: string }
 *
 * The orchestrator (lib/spherePrediction/sendEquityMessage) handles the
 * ownership check, consent gate (TCPA / DNC), provider send, conversation
 * append, audit row, and last_contacted_at bump. This route is just the
 * thin auth + entitlement wrapper.
 *
 * HTTP status mapping:
 *   400 — empty body / subject, malformed channel
 *   401 — not authenticated
 *   403 — no agent row, or paywall (subscriptionRequiredResponse path)
 *   404 — contact not owned by this agent (existence not leaked)
 *   409 — consent / opt-out / wrong-lifecycle blocks send (recoverable)
 *   502 — provider (Twilio / Resend) failure
 *   503 — provider not configured for this environment
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ contactId: string }> },
) {
  try {
    const { contactId } = await ctx.params;
    if (!contactId || typeof contactId !== "string") {
      return NextResponse.json({ ok: false, error: "missing_contact_id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      channel?: string;
      body?: string;
      emailSubject?: string;
    };

    if (body.channel !== "sms" && body.channel !== "email") {
      return NextResponse.json({ ok: false, error: "invalid_channel" }, { status: 400 });
    }
    if (typeof body.body !== "string") {
      return NextResponse.json({ ok: false, error: "missing_body" }, { status: 400 });
    }

    const supabase = supabaseServerClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!userData.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    if (!(await userHasCrmFeature(userData.user.id, "prediction"))) {
      return subscriptionRequiredResponse("prediction", "crm_prediction_locked");
    }

    const { data: agentRow } = await supabase
      .from("agents")
      .select("id")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();

    const agentId = agentRow?.id != null ? String(agentRow.id) : null;
    if (agentId == null) {
      return NextResponse.json(
        { ok: false, error: "Complete agent signup before using the CRM.", code: "NO_AGENT_ROW" },
        { status: 403 },
      );
    }

    const result = await sendEquityMessage({
      agentId,
      contactId,
      channel: body.channel,
      body: body.body,
      emailSubject: body.emailSubject,
    });

    if (isSendEquityFailure(result)) {
      const status =
        result.code === "contact_not_found"
          ? 404
          : result.code === "channel_not_configured"
            ? 503
            : result.code === "send_failed"
              ? 502
              : // wrong_lifecycle, automation_disabled, *_opt_out, *_consent_missing,
                // no_email, no_phone, empty_message → recoverable agent-side.
                409;
      return NextResponse.json(
        { ok: false, code: result.code, error: result.reason },
        { status },
      );
    }

    return NextResponse.json({
      ok: true,
      channel: result.channel,
      sentAt: result.sentAt,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
