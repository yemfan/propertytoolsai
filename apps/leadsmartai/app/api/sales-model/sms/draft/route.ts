import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { canUseAiAction } from "@/lib/entitlements/accessResult";
import { consumeAiToken } from "@/lib/entitlements/consumeAiToken";
import { getSelectedSalesModelServer } from "@/lib/sales-model-server";
import {
  draftSmsMessage,
  loadSmsConversation,
} from "@/lib/sales-model-sms";
import { DEFAULT_SALES_MODEL, isSalesModelId } from "@/lib/sales-models";

export const runtime = "nodejs";

/**
 * POST /api/sales-model/sms/draft
 *
 * Body: { contactId, situation, salesModel? }
 *
 * Generates an outbound SMS draft for the contact, using the agent's
 * sales-model tone. Auto-classifies as INITIAL OUTREACH or REPLY based
 * on whether the contact already has SMS history — caller doesn't have
 * to know the difference.
 *
 * Quota gated via the same canUseAiAction → consumeAiToken pattern as
 * the script generator. Sending the eventual SMS is a separate billing
 * concern (Twilio charges per segment) and lives in the /send route.
 */
export async function POST(req: Request) {
  let userId: string;
  let agentId: string;
  try {
    const ctx = await getCurrentAgentContext();
    userId = ctx.userId;
    agentId = ctx.agentId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    return NextResponse.json(
      { ok: false, error: msg, code: "unauthorized" },
      { status: msg === "Not authenticated" ? 401 : 500 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    contactId?: unknown;
    situation?: unknown;
    salesModel?: unknown;
  };
  const contactId =
    typeof body.contactId === "string" ? body.contactId.trim() : "";
  if (!contactId) {
    return NextResponse.json(
      { ok: false, error: "contactId is required.", code: "missing_contact_id" },
      { status: 400 },
    );
  }
  const situation =
    typeof body.situation === "string" ? body.situation.trim() : "";
  if (situation.length > 4000) {
    return NextResponse.json(
      { ok: false, error: "situation is too long.", code: "situation_too_long" },
      { status: 400 },
    );
  }

  // Resolve the sales model: explicit body override > persisted > default.
  let modelIdValue = isSalesModelId(body.salesModel) ? body.salesModel : null;
  if (!modelIdValue) {
    modelIdValue = await getSelectedSalesModelServer(userId);
  }
  const modelId = modelIdValue ?? DEFAULT_SALES_MODEL;

  // Load contact + history so the draft helper has full context. The
  // load also enforces ownership.
  const conv = await loadSmsConversation(agentId, contactId);
  if (!conv.contact) {
    return NextResponse.json(
      { ok: false, error: "Contact not found.", code: "contact_not_found" },
      { status: 404 },
    );
  }

  // Quota gate.
  const access = await canUseAiAction(userId);
  if (!access.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error:
          access.reason === "no_agent_entitlement"
            ? "Your account is not provisioned for AI actions yet."
            : "You've reached your AI action limit for this period.",
        code: access.reason ?? "ai_action_blocked",
        limit: access.limit ?? null,
        currentUsage: access.currentUsage ?? null,
      },
      { status: 402 },
    );
  }

  const result = await draftSmsMessage({
    modelId,
    situation,
    contact: conv.contact,
    conversation: conv.messages,
  });
  if (result.ok === false) {
    const status =
      result.code === "ai_unconfigured"
        ? 503
        : result.code === "openai_error" || result.code === "openai_unreachable"
          ? 502
          : 500;
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code },
      { status },
    );
  }

  // Best-effort token consumption — don't block on metering.
  consumeAiToken(userId).catch((err) => {
    console.warn(
      "[sales-model/sms/draft] consumeAiToken failed:",
      err instanceof Error ? err.message : err,
    );
  });

  return NextResponse.json({
    ok: true,
    draft: result.draft,
    isReply: conv.messages.length > 0,
    salesModel: modelId,
  });
}
