import Link from "next/link";
import { requireRole } from "@/lib/auth/requireRole";
import { RbacPageShell } from "@/components/rbac/RbacPageShell";

export const dynamic = "force-dynamic";

const ADMIN_LINKS = [
  { href: "/admin/platform-overview", label: "Platform overview",   description: "Cross-product KPIs, funnel, and ops" },
  { href: "/admin/users",             label: "User management",      description: "View, filter, and manage all users" },
  { href: "/admin/performance",       label: "Performance",          description: "Agent and source performance analytics" },
  { href: "/admin/valuation/training",label: "Valuation training",   description: "AVM model weights and training data" },
  { href: "/admin/jobs",              label: "Cron job monitor",     description: "View schedules, trigger jobs manually, inspect results" },
];

export default async function AdminPage() {
  const user = await requireRole(["admin"]);

  return (
    <RbacPageShell
      title="Admin console"
      description="Full access to internal tooling and platform operations."
      roleLabel={user.role}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {ADMIN_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
          >
            <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-700">
              {link.label}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{link.description}</p>
          </Link>
        ))}
      </div>
    </RbacPageShell>
  );
}
