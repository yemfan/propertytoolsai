import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/authFromRequest";

/**
 * Phase 2c: legacy callers still pass status values like "pending" or
 * "completed" / "skipped" / "deferred" that came from the old
 * public.tasks vocabulary. Translate to the crm_tasks check-constraint
 * values; unknown statuses pass through so explicit crm_tasks values
 * still work.
 */
function mapLegacyStatus(s: string): string | null {
  switch (s) {
    case "pending":
      return "open";
    case "completed":
      return "done";
    case "skipped":
      return "cancelled";
    case "deferred":
      return "snoozed";
    case "open":
    case "done":
    case "cancelled":
    case "snoozed":
    case "in_progress":
      return s;
    default:
      return null;
  }
}

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

    // Phase 2c: read from crm_tasks. Old `tasks.type` is now `task_type`,
    // and `tasks.due_date` (date) is `due_at` (timestamptz). Caller-side
    // status mapping: clients still pass legacy values like "pending"
    // / "completed" / "skipped" / "deferred" — translate to the
    // crm_tasks vocabulary so existing UIs keep working.
    let q = supabaseServer
      .from("crm_tasks")
      .select("id,contact_id,title,description,task_type,status,due_at,deferred_until,source,priority,created_at,updated_at")
      .eq("agent_id", agentId);

    if (status) {
      const mapped = mapLegacyStatus(status);
      if (mapped) q = q.eq("status", mapped);
    }

    if (todayFlag) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startIso = today.toISOString();
      const end = new Date(today);
      end.setUTCDate(end.getUTCDate() + 1);
      const endIso = end.toISOString();
      q = q.gte("due_at", startIso).lt("due_at", endIso);
    }

    q = q.order("due_at", { ascending: true }).order("created_at", { ascending: true }).limit(100);

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
    const { lead_id, contact_id, title, description, type, due_date } = body;
    if (!title || !type || !due_date) {
      return NextResponse.json(
        { ok: false, error: "title, type, and due_date are required." },
        { status: 400 }
      );
    }

    // Phase 2c: write to crm_tasks. lead_id (legacy bigint name) and
    // contact_id (current uuid name) both map to the contact_id column.
    // due_date (date string) gets bumped to a noon-UTC timestamp so it
    // sorts predictably with timestamp-typed rows from other writers.
    const dueAt = `${String(due_date).slice(0, 10)}T17:00:00.000Z`;
    const { data, error } = await supabaseServer
      .from("crm_tasks")
      .insert({
        agent_id: agentId,
        contact_id: contact_id ?? lead_id ?? null,
        title,
        description: description ?? null,
        task_type: type,
        source: "manual",
        due_at: dueAt,
      })
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

