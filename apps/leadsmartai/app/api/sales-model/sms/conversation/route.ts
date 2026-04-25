import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { loadSmsConversation } from "@/lib/sales-model-sms";

export const runtime = "nodejs";

/**
 * GET /api/sales-model/sms/conversation?contactId=...
 *
 * Returns `{ messages, contact }` for the contact, ownership-scoped
 * to the signed-in agent. The modal calls this on open and polls it
 * every 5s while open so inbound replies stream in.
 *
 * 404 if the contact doesn't belong to the agent — never reveal
 * existence of contacts owned by other agents.
 */
export async function GET(req: Request) {
  let agentId: string;
  try {
    const ctx = await getCurrentAgentContext();
    agentId = ctx.agentId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: msg === "Not authenticated" ? 401 : 500 },
    );
  }

  const url = new URL(req.url);
  const contactId = url.searchParams.get("contactId")?.trim() ?? "";
  if (!contactId) {
    return NextResponse.json(
      { ok: false, error: "contactId is required.", code: "missing_contact_id" },
      { status: 400 },
    );
  }

  const result = await loadSmsConversation(agentId, contactId);
  if (!result.contact) {
    return NextResponse.json(
      { ok: false, error: "Contact not found.", code: "contact_not_found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    contact: result.contact,
    messages: result.messages,
  });
}
