import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { canUseAiAction } from "@/lib/entitlements/accessResult";
import { consumeAiToken } from "@/lib/entitlements/consumeAiToken";
import { getSelectedSalesModelServer } from "@/lib/sales-model-server";
import { draftEmailMessage } from "@/lib/sales-model-email";
import { DEFAULT_SALES_MODEL, isSalesModelId } from "@/lib/sales-models";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * POST /api/sales-model/email/draft
 *
 * Body: { contactId, situation, salesModel? }
 *
 * Generates an email draft (subject + body) tuned to the agent's
 * sales-model tone. Quota gated through canUseAiAction → consumeAiToken
 * (same wallet as the SMS draft + script generator).
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

  let modelIdValue = isSalesModelId(body.salesModel) ? body.salesModel : null;
  if (!modelIdValue) {
    modelIdValue = await getSelectedSalesModelServer(userId);
  }
  const modelId = modelIdValue ?? DEFAULT_SALES_MODEL;

  // Resolve contact + ownership check via search helper. We pass the
  // exact id as the query — Supabase ilike will match (or we can do a
  // direct lookup). Use a direct query for clarity:
  const { data: contactRow } = await supabaseAdmin
    .from("contacts")
    .select("id, name, first_name, last_name, email, property_address")
    .eq("id", contactId)
    .eq("agent_id", agentId)
    .maybeSingle();
  if (!contactRow) {
    return NextResponse.json(
      { ok: false, error: "Contact not found.", code: "contact_not_found" },
      { status: 404 },
    );
  }
  type Row = {
    id: string;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    property_address: string | null;
  };
  const c = contactRow as Row;
  const contact = {
    id: c.id,
    name:
      c.first_name || c.last_name
        ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()
        : (c.name ?? null),
    email: c.email,
    property_address: c.property_address,
  };
  if (!contact.email || !contact.email.includes("@")) {
    return NextResponse.json(
      {
        ok: false,
        error: "This contact has no email address on file.",
        code: "no_email",
      },
      { status: 400 },
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

  const result = await draftEmailMessage({
    modelId,
    situation,
    contact,
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

  consumeAiToken(userId).catch((err) => {
    console.warn(
      "[sales-model/email/draft] consumeAiToken failed:",
      err instanceof Error ? err.message : err,
    );
  });

  return NextResponse.json({
    ok: true,
    subject: result.subject,
    body: result.body,
    salesModel: modelId,
  });
}
