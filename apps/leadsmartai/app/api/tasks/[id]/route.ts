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

    // Phase 2c: action vocabulary stays the same for callers, but we
    // translate to the crm_tasks status set. "skip" → "cancelled";
    // "defer" → "snoozed" with snoozed_until + deferred_until both
    // set so the date-cron can pick it back up.
    let nextStatus: string | null = null;
    if (action === "done") nextStatus = "done";
    else if (action === "skip") nextStatus = "cancelled";
    else if (action === "defer") nextStatus = "snoozed";

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

    if (nextStatus === "done") {
      patch.completed_at = new Date().toISOString();
    }

    if (nextStatus === "snoozed") {
      if (!deferred_until) {
        return NextResponse.json(
          { ok: false, error: "deferred_until is required for defer action." },
          { status: 400 }
        );
      }
      patch.deferred_until = deferred_until;
      // snoozed_until is timestamptz; clamp to noon UTC of the date so
      // the cron's date<=today comparison is unambiguous.
      patch.snoozed_until = `${String(deferred_until).slice(0, 10)}T12:00:00.000Z`;
    }

    const { data, error } = await supabaseServer
      .from("crm_tasks")
      .update(patch)
      .eq("id", id)
      .eq("agent_id", agentId)
      .select("id,contact_id,title,description,task_type,status,due_at,deferred_until,source,priority,created_at,updated_at")
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

