import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { getPropertyToolsConsumerPostLoginUrl } from "@/lib/propertyToolsConsumerUrl";
import { isRealEstateProfessionalRole } from "@/lib/paidSubscriptionEligibility";
import {
  UNAUTHORIZED_PATH,
  BROKER_PORTAL_ROLES,
  matchesPortalKind,
  resolveRoleHomePath,
  type PortalKind,
} from "@/lib/rolePortalPaths";

function missingUserIdColumn(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? "");
  return (
    /user_id.*does not exist/i.test(msg) ||
    /column\s+.*user_id.*does not exist/i.test(msg)
  );
}

export type UserPortalContext = {
  userId: string;
  role: string | null;
  hasAgentRow: boolean;
  isPro: boolean;
};

export async function fetchUserPortalContext(
  supabase: SupabaseClient
): Promise<UserPortalContext | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const userId = user.id;
  let role: string | null = null;
  let hasAgentRow = false;
  let isPro = false;

  try {
    let userRow: { role?: string } | null = null;
    let rowErr: unknown = null;
    ({ data: userRow, error: rowErr } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle());

    if (rowErr && missingUserIdColumn(rowErr)) {
      rowErr = null;
    }

    const r = userRow?.role ?? null;
    role = r ?? null;

    const { data: agentRow } = await supabase
      .from("agents")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();
    hasAgentRow = !!agentRow;

    if (!rowErr && r === "user" && !hasAgentRow) {
      isPro = false;
    } else {
      isPro = isRealEstateProfessionalRole(r) || hasAgentRow;
    }
  } catch {
    const { data: agentRow } = await supabase
      .from("agents")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();
    hasAgentRow = !!agentRow;
    isPro = hasAgentRow;
    role = null;
  }

  return { userId, role, hasAgentRow, isPro };
}

/**
 * `null` = show public marketing home (`LeadSmartLanding`).
 * Signed-in professionals redirect to their dashboard; everyone else stays on marketing home.
 */
export async function resolvePostAuthHomePath(supabase: SupabaseClient): Promise<string | null> {
  const ctx = await fetchUserPortalContext(supabase);
  if (!ctx) return null;
  if (!ctx.isPro) return null;
  return resolveRoleHomePath(ctx.role, ctx.hasAgentRow);
}

export function ensurePortalAccess(kind: PortalKind, ctx: UserPortalContext | null): void {
  if (!ctx) {
    redirect(`/login?redirect=/${kind}`);
  }

  // Admin / support trees: wrong role → explicit unauthorized (not bounced to another dashboard).
  if (kind === "admin") {
    if (!matchesPortalKind(ctx.role, "admin")) {
      redirect(UNAUTHORIZED_PATH);
    }
    if (!ctx.isPro) {
      redirect(getPropertyToolsConsumerPostLoginUrl());
    }
    return;
  }

  if (!ctx.isPro) {
    redirect(getPropertyToolsConsumerPostLoginUrl());
  }
  if (!matchesPortalKind(ctx.role, kind)) {
    redirect(resolveRoleHomePath(ctx.role, ctx.hasAgentRow));
  }
}
