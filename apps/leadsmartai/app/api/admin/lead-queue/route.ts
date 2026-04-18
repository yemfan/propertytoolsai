import { NextResponse } from "next/server";
import { requireRoleRoute } from "@/lib/auth/requireRole";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  try {
    const auth = await requireRoleRoute(["admin", "support"], { strictUnauthorized: true });
    if (auth.ok === false) return auth.response;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? 50)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const [leadsResult, agentsResult] = await Promise.all([
      supabaseAdmin
        .from("contacts")
        .select(
          "id, name, email, phone, property_address, source, lead_status, rating, created_at",
          { count: "exact" }
        )
        .is("agent_id", null)
        .order("created_at", { ascending: false })
        .range(from, to),
      supabaseAdmin
        .from("agents")
        .select("id, name, email")
        .order("name", { ascending: true }),
    ]);

    if (leadsResult.error) throw leadsResult.error;
    if (agentsResult.error) throw agentsResult.error;

    return NextResponse.json({
      ok: true,
      leads: leadsResult.data ?? [],
      total: leadsResult.count ?? 0,
      agents: (agentsResult.data ?? []).map((a: any) => ({
        id: String(a.id),
        name: a.name ?? a.email ?? `Agent #${a.id}`,
        email: a.email ?? null,
      })),
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
