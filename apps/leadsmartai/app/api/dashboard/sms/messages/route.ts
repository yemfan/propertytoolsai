import { NextResponse } from "next/server";

import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/sms/messages?contactId=<uuid>&limit=50
 *
 * Returns the per-contact SMS thread (most-recent-last). Used by the
 * AI Guide tabbed panel to render the Contact tab's message history.
 *
 * Reads via supabaseAdmin (service role) but only after verifying the
 * contact belongs to the authed agent — RLS would also block, but
 * checking here keeps the error message useful.
 */
export async function GET(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    if (!agentId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const contactId = String(url.searchParams.get("contactId") ?? "").trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 200);
    if (!contactId) {
      return NextResponse.json({ ok: false, error: "contactId is required" }, { status: 400 });
    }

    const { data: contact, error: contactErr } = await supabaseAdmin
      .from("contacts")
      .select("id, agent_id, auto_pilot")
      .eq("id", contactId)
      .maybeSingle();
    if (contactErr) throw contactErr;
    if (!contact) {
      return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });
    }
    if (String(contact.agent_id) !== String(agentId)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { data: rows, error: rowsErr } = await supabaseAdmin
      .from("sms_messages")
      .select("id, message, direction, created_at, twilio_status")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (rowsErr) throw rowsErr;

    return NextResponse.json({
      ok: true,
      autoPilot: Boolean((contact as { auto_pilot?: boolean }).auto_pilot),
      messages: rows ?? [],
    });
  } catch (e) {
    console.error("[sms/messages] failed", e);
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
