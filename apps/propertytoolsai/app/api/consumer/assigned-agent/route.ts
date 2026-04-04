import { NextResponse } from "next/server";
import type { AssignedAgentPayload } from "@/lib/consumer/assignedAgentTypes";
import { fetchCanonicalUserContact } from "@/lib/auth/canonicalUserContact";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type { AssignedAgentPayload } from "@/lib/consumer/assignedAgentTypes";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function defaultAuthIdFromEnv(): string | null {
  const a =
    process.env.CONSUMER_ASSIGNED_AGENT_AUTH_ID_DEFAULT?.trim() ||
    process.env.CONSUMER_ASIGNED_AGENT_ID_DEFAULT?.trim();
  if (!a) return null;
  if (!UUID_RE.test(a)) {
    console.warn(
      "[assigned-agent] CONSUMER_ASSIGNED_AGENT_AUTH_ID_DEFAULT is not a valid UUID — ignoring.",
      JSON.stringify(a)
    );
    return null;
  }
  return a;
}

function displayNameFromEmailFallback(email: string): string {
  const local = email.split("@")[0]?.trim() ?? "";
  if (!local) return "Your agent";
  const words = local.replace(/[._-]+/g, " ").trim();
  return words
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

async function loadAgentProfile(authUserId: string): Promise<{
  displayName: string;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
}> {
  const contact = await fetchCanonicalUserContact(supabaseAdmin, authUserId);

  const { data: row } = await supabaseAdmin
    .from("user_profiles")
    .select("avatar_url")
    .eq("user_id", authUserId)
    .maybeSingle();

  const email = contact?.email?.trim() || null;
  const fullName = contact?.fullName?.trim() || null;
  const phone = contact?.phone ?? null;

  const displayName =
    fullName ?? (email ? displayNameFromEmailFallback(email) : "Your agent");

  return {
    displayName,
    phone,
    email,
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
