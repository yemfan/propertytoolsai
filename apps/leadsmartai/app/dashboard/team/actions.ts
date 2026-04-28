"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { getTeamAccessStatus } from "@/lib/teams/access.server";
import { TeamSeatError } from "@/lib/teams/seatLimits.server";
import {
  createTeam as svcCreateTeam,
  getRole,
  inviteByEmail,
  removeMember as svcRemoveMember,
  revokeInvite as svcRevokeInvite,
} from "@/lib/teams/service";

/**
 * Server actions for the /dashboard/team UI.
 *
 * Every action resolves the calling agent via getCurrentAgentContext()
 * and authorizes itself before touching the service layer. The
 * service layer bypasses RLS via the service-role client, so this
 * file is the trust boundary.
 */

export async function createTeam(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false as const, error: "Name is required" };
  if (name.length > 80) return { ok: false as const, error: "Name too long" };

  const ctx = await getCurrentAgentContext();

  // Pre-flight: block creation when the plan can't host a team.
  // Without this gate, a Starter agent could create a team and then
  // hit "Owner's plan does not include team access" on every invite —
  // a confusing dead-end with a useless team row in the DB.
  const access = await getTeamAccessStatus(ctx.agentId);
  if (!access.canCreate) {
    return {
      ok: false as const,
      error:
        access.reason === "team_access_not_enabled"
          ? "Team access requires the Elite plan. Upgrade to start a team."
          : "We couldn't verify your subscription. Try again or contact support.",
      code: access.reason,
    };
  }

  const team = await svcCreateTeam({ name, ownerAgentId: ctx.agentId });
  revalidatePath("/dashboard/team");
  return { ok: true as const, teamId: team.id };
}

export async function inviteMember(formData: FormData) {
  const teamId = String(formData.get("teamId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!teamId) return { ok: false as const, error: "Missing team" };
  if (!email || !email.includes("@")) {
    return { ok: false as const, error: "Valid email required" };
  }

  const ctx = await getCurrentAgentContext();
  const role = await getRole({ teamId, agentId: ctx.agentId });
  if (role !== "owner") return { ok: false as const, error: "Owner only" };

  try {
    const result = await inviteByEmail({
      teamId,
      invitedEmail: email,
      invitedByAgentId: ctx.agentId,
    });
    revalidatePath("/dashboard/team");
    return {
      ok: true as const,
      inviteId: result.invite.id,
      rawToken: result.rawToken,
    };
  } catch (e) {
    if (e instanceof TeamSeatError) {
      return { ok: false as const, error: e.message };
    }
    throw e;
  }
}

export async function removeMember(formData: FormData) {
  const teamId = String(formData.get("teamId") ?? "");
  const agentId = String(formData.get("agentId") ?? "");
  if (!teamId || !agentId) return { ok: false as const, error: "Missing args" };

  const ctx = await getCurrentAgentContext();
  if (agentId === ctx.agentId) {
    return { ok: false as const, error: "Owner cannot remove themselves" };
  }
  const role = await getRole({ teamId, agentId: ctx.agentId });
  if (role !== "owner") return { ok: false as const, error: "Owner only" };

  await svcRemoveMember({ teamId, agentId });
  revalidatePath("/dashboard/team");
  return { ok: true as const };
}

export async function revokeInvite(formData: FormData) {
  const teamId = String(formData.get("teamId") ?? "");
  const inviteId = String(formData.get("inviteId") ?? "");
  if (!teamId || !inviteId) return { ok: false as const, error: "Missing args" };

  const ctx = await getCurrentAgentContext();
  const role = await getRole({ teamId, agentId: ctx.agentId });
  if (role !== "owner") return { ok: false as const, error: "Owner only" };

  await svcRevokeInvite(inviteId);
  revalidatePath("/dashboard/team");
  return { ok: true as const };
}
