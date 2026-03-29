import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { getRoleHomePath } from "@/lib/auth/roles";
import { safeInternalRedirect } from "@/lib/loginUrl";

export const dynamic = "force-dynamic";

/**
 * Role hub: authenticated users are sent to `getRoleHomePath(profile.role)`.
 * Optional `redirect` / `next` query params (internal paths only) run first.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ redirect?: string; next?: string }>;
}) {
  const sp = searchParams != null ? await searchParams : {};
  const user = await getCurrentUserWithRole();

  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  const next =
    safeInternalRedirect(sp.redirect) ?? safeInternalRedirect(sp.next);
  if (next) {
    redirect(next);
  }

  redirect(getRoleHomePath(user.role));
}
