import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/authFromRequest";

async function getAgentIdForUser(userId: string) {
  try {
    const { data: agent } = await supabaseServer
      .from("agents")
      .select("id,auth_user_id")
      .eq("auth_user_id", userId)
      .maybeSingle();
    return (agent as any)?.id ?? null;
  } catch {
    // legacy schema may not have auth_user_id
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }
    const agentId = await getAgentIdForUser(user.id);
    if (!agentId) {
      return NextResponse.json({ ok: true, tasks: [] });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "";
    const todayFlag = url.searchParams.get("today") === "true";

    let q = supabaseServer
      .from("tasks")
      .select("id,contact_id,title,description,type,status,due_date,deferred_until,created_at,updated_at")
      .eq("agent_id", agentId);

    if (status) q = q.eq("status", status);

    if (todayFlag) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayDate = today.toISOString().slice(0, 10);
      q = q.eq("due_date", todayDate);
    }

    q = q.order("due_date", { ascending: true }).order("created_at", { ascending: true }).limit(100);

    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json({ ok: true, tasks: data ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }
    const agentId = await getAgentIdForUser(user.id);
    if (!agentId) {
      return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as any;
    const { lead_id, title, description, type, due_date } = body;
    if (!title || !type || !due_date) {
      return NextResponse.json(
        { ok: false, error: "title, type, and due_date are required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from("tasks")
      .insert({
        agent_id: agentId,
        contact_id: lead_id ?? null,
        title,
        description: description ?? null,
        type,
        due_date,
      })
      .select("id,contact_id,title,description,type,status,due_date,deferred_until,created_at,updated_at")
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, task: data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

