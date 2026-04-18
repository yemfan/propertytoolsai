import { NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  try {
    const supabase = supabaseServerClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();

    if (!agent?.id) {
      return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? 50)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabaseServer
      .from("contacts")
      .select(
        "id, name, email, phone, property_address, source, lead_status, rating, created_at",
        { count: "exact" }
      )
      .is("agent_id", null)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      leads: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
