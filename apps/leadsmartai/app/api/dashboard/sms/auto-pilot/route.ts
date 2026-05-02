import { NextResponse } from "next/server";

import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * PATCH /api/dashboard/sms/auto-pilot
 *
 * Body: `{ contactId: string, enabled: boolean }`
 *
 * Flips the per-contact `auto_pilot` flag. Server-side state is the
 * source of truth so the Twilio inbound webhook (which has no client
 * session) can read it and decide whether to auto-reply.
 */
export async function PATCH(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    if (!agentId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      contactId?: string;
      enabled?: boolean;
    };
    const contactId = String(body.contactId ?? "").trim();
    if (!contactId || typeof body.enabled !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "contactId and enabled are required" },
        { status: 400 },
      );
    }

    const { data: contact, error: contactErr } = await supabaseAdmin
      .from("contacts")
      .select("id, agent_id")
      .eq("id", contactId)
      .maybeSingle();
    if (contactErr) throw contactErr;
    if (!contact) {
      return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });
    }
    if (String(contact.agent_id) !== String(agentId)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { error: updErr } = await supabaseAdmin
      .from("contacts")
      .update({ auto_pilot: body.enabled, updated_at: new Date().toISOString() })
      .eq("id", contactId);
    if (updErr) throw updErr;

    return NextResponse.json({ ok: true, autoPilot: body.enabled });
  } catch (e) {
    console.error("[sms/auto-pilot] failed", e);
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
