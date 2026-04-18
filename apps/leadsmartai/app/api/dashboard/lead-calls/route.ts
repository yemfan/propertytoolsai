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
        "id,contact_id,twilio_call_sid,from_phone,to_phone,direction,status,call_status,hot_lead,escalation_reason,summary,transcript,recording_url,created_at,updated_at,duration_seconds,first_utterance"
      )
      .eq("agent_id", agentId as never)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Enrich with lead names
    const leadIds = [...new Set((rows ?? []).map((r: any) => r.contact_id).filter(Boolean))];
    let leadMap = new Map<string, string>();
    if (leadIds.length > 0) {
      const { data: leads } = await supabaseAdmin
        .from("contacts")
        .select("id,name,phone")
        .in("id", leadIds);
      if (leads) {
        for (const l of leads) {
          leadMap.set(String((l as any).id), (l as any).name ?? "");
        }
      }
    }

    const calls = (rows ?? []).map((r: any) => ({
      ...r,
      lead_name: r.contact_id ? leadMap.get(String(r.contact_id)) ?? null : null,
    }));

    return NextResponse.json({ calls });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    console.error("lead-calls GET error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
