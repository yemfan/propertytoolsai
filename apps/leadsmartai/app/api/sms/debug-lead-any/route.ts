import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

// Dev-only helper: fetch any lead with a phone present.
export async function GET(req: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ ok: false, error: "disabled" }, { status: 403 });
    }

    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? "1");

    const { data: leadRows, error } = await supabaseServer
      .from("contacts")
      .select("id,phone,contact_method,automation_disabled,rating,property_address,name")
      .not("phone", "is", null)
      .order("created_at", { ascending: false })
      .limit(Number.isFinite(limit) ? Math.max(1, limit) : 1);

    if (error) throw error;

    const row = Array.isArray(leadRows) ? leadRows[0] : null;
    return NextResponse.json({ ok: true, lead: row ?? null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}

