import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabaseServerClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "40"), 100);

    const supabase = supabaseServerClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!userData.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: agentRow } = await supabase
      .from("agents")
      .select("id")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();

    const agentId = agentRow != null ? String((agentRow as { id: unknown }).id) : null;
    if (!agentId) {
      return NextResponse.json({ error: "NO_AGENT" }, { status: 403 });
    }

    const { data: rows, error } = await supabaseAdmin
      .from("lead_calls")
      .select(
        "id,lead_id,twilio_call_sid,from_phone,to_phone,status,inferred_intent,hot_lead,needs_human,summary,transcript,created_at,ended_at,duration_seconds,leads(name,phone,phone_number)"
      )
      .eq("agent_id", agentId as never)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ calls: rows ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
