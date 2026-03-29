import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function GET() {
  try {
    const todayIso = startOfTodayIso();
    const todayDate = todayIso.slice(0, 10);

    const { data, error } = await supabaseServer
      .from("tasks")
      .select("id")
      .eq("status", "deferred")
      .lte("deferred_until", todayDate)
      .limit(500);
    if (error) throw error;

    const ids = ((data as any[]) ?? []).map((t) => t.id);
    if (ids.length) {
      const now = new Date().toISOString();
      await supabaseServer
        .from("tasks")
        .update({ status: "pending", updated_at: now })
        .in("id", ids);
    }

    return NextResponse.json({ ok: true, reactivated: ids.length });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

