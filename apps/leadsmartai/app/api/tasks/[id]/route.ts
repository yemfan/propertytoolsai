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

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }
    const agentId = await getAgentIdForUser(user.id);
    if (!agentId) {
      return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 });
    }

    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as any;
    const { action, deferred_until } = body;

    let nextStatus: string | null = null;
    if (action === "done") nextStatus = "done";
    else if (action === "skip") nextStatus = "skipped";
    else if (action === "defer") nextStatus = "deferred";

    if (!nextStatus) {
      return NextResponse.json(
        { ok: false, error: "Invalid action." },
        { status: 400 }
      );
    }

    const patch: any = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };

    if (nextStatus === "deferred") {
      if (!deferred_until) {
        return NextResponse.json(
          { ok: false, error: "deferred_until is required for defer action." },
          { status: 400 }
        );
      }
      patch.deferred_until = deferred_until;
    }

    const { data, error } = await supabaseServer
      .from("tasks")
      .update(patch)
      .eq("id", id)
      .eq("agent_id", agentId)
      .select("id,lead_id,title,description,type,status,due_date,deferred_until,created_at,updated_at")
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

