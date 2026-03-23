import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import {
  resolveRoleHomePath,
  UNAUTHORIZED_PATH,
} from "@/lib/rolePortalPaths";
import { fetchUserPortalContext, type UserPortalContext } from "@/lib/rolePortalServer";
import { supabaseServerClient } from "@/lib/supabaseServerClient";

export type RequireRoleOptions = {
  /**
   * When the user is not logged in, redirect here instead of `/login`.
   * Include query string if needed (e.g. `/login?redirect=/agent/dashboard`).
   */
  loginRedirect?: string;
  /**
   * When logged in but role is not allowed: send to `/unauthorized` (admin/support APIs).
   */
  strictUnauthorized?: boolean;
  /**
   * When logged in but role is not allowed: send here instead of role home
   * (e.g. agent upgrade funnel). Ignored if `strictUnauthorized` is true.
   */
  upgradeRedirect?: string;
};

/**
 * Server-only guard for App Router pages. Redirects unauthenticated users to `/login`,
 * and users whose `user_profiles.role` is not in `allowed` to their role home,
 * unless `strictUnauthorized` or `upgradeRedirect` is set.
 */
export async function requireRole(allowed: string[], options?: RequireRoleOptions) {
  const supabase = supabaseServerClient();
  const ctx = await fetchUserPortalContext(supabase);

  if (!ctx) {
    redirect(options?.loginRedirect ?? "/login");
  }

  const r = String(ctx.role ?? "").toLowerCase().trim();
  const ok = allowed.some((a) => a.toLowerCase().trim() === r);

  if (!ok) {
    if (options?.strictUnauthorized) {
      redirect(UNAUTHORIZED_PATH);
    }
    if (options?.upgradeRedirect) {
      redirect(options.upgradeRedirect);
    }
    redirect(resolveRoleHomePath(ctx.role, ctx.hasAgentRow));
  }

  return ctx;
}

export type RequireRoleRouteResult =
  | { ok: true; ctx: UserPortalContext }
  | { ok: false; response: NextResponse };

export type RequireRoleRouteOptions = Pick<RequireRoleOptions, "strictUnauthorized">;

/**
 * **Route Handlers** (API): use `redirect()` would break JSON clients. Returns `401` / `403`
 * JSON responses instead of calling `redirect()`.
 */
export async function requireRoleRoute(
  allowed: string[],
  options?: RequireRoleRouteOptions
): Promise<RequireRoleRouteResult> {
  const supabase = supabaseServerClient();
  const ctx = await fetchUserPortalContext(supabase);

  if (!ctx) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }

  const r = String(ctx.role ?? "").toLowerCase().trim();
  const ok = allowed.some((a) => a.toLowerCase().trim() === r);

  if (!ok) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: "Forbidden",
          ...(options?.strictUnauthorized ? { code: "forbidden_rbac" as const } : {}),
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true, ctx };
}
