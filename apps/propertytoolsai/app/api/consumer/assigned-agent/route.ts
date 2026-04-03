import { NextResponse } from "next/server";
import type { AssignedAgentPayload } from "@/lib/consumer/assignedAgentTypes";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type { AssignedAgentPayload } from "@/lib/consumer/assignedAgentTypes";

function defaultAuthIdFromEnv(): string | null {
  const a =
    process.env.CONSUMER_ASSIGNED_AGENT_AUTH_ID_DEFAULT?.trim() ||
    process.env.CONSUMER_ASIGNED_AGENT_ID_DEFAULT?.trim();
  return a || null;
}

async function loadAgentProfile(authUserId: string): Promise<{
  displayName: string;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
}> {
  const { data: row } = await supabaseAdmin
    .from("user_profiles")
    .select("full_name,phone,avatar_url,email")
    .eq("user_id", authUserId)
    .maybeSingle();

  return {
    displayName: row?.full_name != null && String(row.full_name).trim() ? String(row.full_name) : "Your agent",
    phone: row?.phone != null ? String(row.phone) : null,
    email: row?.email != null ? String(row.email) : null,
    avatarUrl: row?.avatar_url != null ? String(row.avatar_url) : null,
  };
}

/**
 * Resolves the consumer's assigned agent (`leadsmart_users.agent_id`), or the default
 * env agent (`CONSUMER_ASSIGNED_AGENT_AUTH_ID_DEFAULT` = Supabase `auth.users` id).
 */
export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);

    let resolvedAuthUserId: string | null = null;
    let resolvedAgentRowId: string | null = null;
    let assignmentSource: "profile" | "default" = "default";

    if (user) {
      const { data: prof } = await supabaseAdmin
        .from("user_profiles")
        .select("leadsmart_users(agent_id)")
        .eq("user_id", user.id)
        .maybeSingle();

      const lsRaw = (prof as { leadsmart_users?: { agent_id?: string | null } | { agent_id?: string | null }[] | null })
        ?.leadsmart_users;
      const ls = lsRaw == null ? null : Array.isArray(lsRaw) ? lsRaw[0] : lsRaw;
      const agentIdFromProfile = ls?.agent_id != null ? String(ls.agent_id).trim() : "";

      if (agentIdFromProfile) {
        const { data: agentRow } = await supabaseAdmin
          .from("agents")
          .select("id, auth_user_id")
          .eq("id", agentIdFromProfile)
          .maybeSingle();

        if (agentRow?.auth_user_id) {
          resolvedAuthUserId = String(agentRow.auth_user_id);
          resolvedAgentRowId = String(agentRow.id);
          assignmentSource = "profile";
        }
      }
    }

    if (!resolvedAuthUserId) {
      const def = defaultAuthIdFromEnv();
      if (def) {
        const { data: agentRow } = await supabaseAdmin
          .from("agents")
          .select("id, auth_user_id")
          .eq("auth_user_id", def)
          .maybeSingle();

        if (agentRow?.auth_user_id) {
          resolvedAuthUserId = String(agentRow.auth_user_id);
          resolvedAgentRowId = String(agentRow.id);
          assignmentSource = "default";
        } else {
          resolvedAuthUserId = def;
          assignmentSource = "default";
        }
      }
    }

    if (!resolvedAuthUserId) {
      return NextResponse.json({ ok: true, agent: null });
    }

    const prof = await loadAgentProfile(resolvedAuthUserId);

    const payload: AssignedAgentPayload = {
      authUserId: resolvedAuthUserId,
      agentRowId: resolvedAgentRowId,
      displayName: prof.displayName,
      phone: prof.phone,
      email: prof.email,
      avatarUrl: prof.avatarUrl,
      assignmentSource,
    };

    return NextResponse.json({ ok: true, agent: payload });
  } catch (e) {
    console.error("GET /api/consumer/assigned-agent", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
