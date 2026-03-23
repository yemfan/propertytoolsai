import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { safeInternalRedirect } from "@/lib/loginUrl";

export const dynamic = "force-dynamic";

export default async function DashboardRouterPage({
  searchParams,
}: {
  searchParams?: Promise<{ redirect?: string }>;
}) {
  const sp = searchParams != null ? await searchParams : {};
  const user = await getCurrentUserWithRole();

  if (!user) {
    redirect("/login?redirect=/dashboard-router");
  }

  const next = safeInternalRedirect(sp.redirect);
  if (next) {
    redirect(next);
  }

  switch (user.role) {
    case "admin":
      redirect("/admin/platform-overview");
    case "agent":
      redirect("/agent/dashboard");
    case "loan_broker":
      redirect("/loan-broker/dashboard");
    case "support":
      redirect("/support/dashboard");
    case "consumer":
    default:
      redirect("/propertytools/dashboard");
  }
}
