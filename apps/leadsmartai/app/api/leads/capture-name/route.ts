import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      leadId?: string | number;
      name?: string;
    };

    const leadId = String(body.leadId ?? "").trim();
    const name = String(body.name ?? "").trim();

    if (!leadId) {
      return NextResponse.json({ ok: false, error: "leadId is required." }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ ok: false, error: "name is required." }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from("contacts")
      .update({ name, stage: "name_captured" } as any)
      .eq("id", leadId)
      .select("id,stage")
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ ok: true, leadId, stage: (data as any)?.stage ?? "name_captured" });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

