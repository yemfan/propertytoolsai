import { NextResponse } from "next/server";
import type { AssignedAgentPayload } from "@/lib/consumer/assignedAgentTypes";
import { fetchCanonicalUserContact } from "@/lib/auth/canonicalUserContact";
import { getUserFromRequest } from "@/lib/authFromRequest";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type { AssignedAgentPayload } from "@/lib/consumer/assignedAgentTypes";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reads the default-agent UUID from `CONSUMER_ASSIGNED_AGENT_AUTH_ID_DEFAULT`.
 *
 * Historical note: an earlier release shipped with the misspelled variant
 * `CONSUMER_ASIGNED_AGENT_ID_DEFAULT` (single S in "ASIGNED"). That fallback
 * was removed in this commit because it created a footgun — `.env.local`
 * could silently end up with the typo'd name pointing at a stale/invalid
 * UUID while production correctly used the new name with a real UUID, so
 * the bug only reproduced locally and was hard to spot. If you're updating
 * an existing environment, rename the var to the canonical spelling.
 */
function defaultAuthIdFromEnv(): string | null {
  const a = process.env.CONSUMER_ASSIGNED_AGENT_AUTH_ID_DEFAULT?.trim();
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
 * Resolves the consumer's assigned agent (`leadsmart_users.agent_uuid`), or the default
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
        .select("leadsmart_users(agent_uuid)")
        .eq("user_id", user.id)
        .maybeSingle();

      const lsRaw = (prof as { leadsmart_users?: { agent_uuid?: string | null } | { agent_uuid?: string | null }[] | null })
        ?.leadsmart_users;
      const ls = lsRaw == null ? null : Array.isArray(lsRaw) ? lsRaw[0] : lsRaw;
      const agentUuid = ls?.agent_uuid != null ? String(ls.agent_uuid).trim() : "";

      if (agentUuid && UUID_RE.test(agentUuid)) {
        const { data: agentRow } = await supabaseAdmin
          .from("agents")
          .select("id, auth_user_id")
          .eq("auth_user_id", agentUuid)
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

    /**
     * Dev-only sanity check: when the env-pointed default agent resolves
     * to a profile with no contact info AND no real display name, the
     * UUID is almost certainly stale or pointing at a deleted auth.users
     * row. The card will render with greyed-out Call/Email buttons and a
     * "Y" placeholder avatar, which reads as a broken widget.
     *
     * We log a clear warning here so the next developer who trips on this
     * sees the cause immediately instead of debugging the UI. Production
     * stays silent (no log spam) because `NODE_ENV === "production"`.
     */
    if (
      process.env.NODE_ENV !== "production" &&
      assignmentSource === "default" &&
      !prof.email &&
      !prof.phone &&
      prof.displayName === "Your agent"
    ) {
      console.warn(
        `[assigned-agent] CONSUMER_ASSIGNED_AGENT_AUTH_ID_DEFAULT="${resolvedAuthUserId}" did not resolve to a real auth.users row — the sidebar AssignedAgentCard will render an empty/placeholder state. Update .env.local (and Vercel env) to a UUID that exists in auth.users with email/phone populated.`
      );
    }

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
