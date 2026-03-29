import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

// Dev-only helper: set sms_opt_in=true for a lead id.
// POST /api/sms/debug-opt-in { leadId: "123" }
export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ ok: false, error: "disabled" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { leadId?: string | number };
    const leadId = String(body.leadId ?? "").trim();
    if (!leadId) return NextResponse.json({ ok: false, error: "leadId required" }, { status: 400 });

    const { data: leadRow, error: leadErr } = await supabaseServer
      .from("leads")
      .select("id,phone,contact_method,sms_opt_in")
      .eq("id", leadId)
      .maybeSingle();
    if (leadErr) throw leadErr;
    if (!leadRow) return NextResponse.json({ ok: false, error: "lead not found" }, { status: 404 });

    // Prefer `sms_opt_in` if column exists; otherwise fall back to `contact_method`.
    try {
      const { error: updErr } = await supabaseServer
        .from("leads")
        .update({ sms_opt_in: true } as any)
        .eq("id", leadId);
      if (updErr) throw updErr;
    } catch {
      const { error: updErr2 } = await supabaseServer
        .from("leads")
        .update({ contact_method: "sms" } as any)
        .eq("id", leadId);
      if (updErr2) throw updErr2;
    }

    return NextResponse.json({ ok: true, lead: { ...(leadRow as any), sms_opt_in: true } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}

