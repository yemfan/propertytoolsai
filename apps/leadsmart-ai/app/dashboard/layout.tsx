import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import TopBar from "@/components/dashboard/TopBar";
import { supabaseServer } from "@/lib/supabaseServer";

const nav = [
  { href: "/dashboard/overview", label: "Overview" },
  { href: "/dashboard/performance", label: "Performance" },
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/opportunities", label: "Marketplace" },
  { href: "/dashboard/notifications", label: "Notifications" },
  { href: "/dashboard/automation", label: "Automation" },
  { href: "/dashboard/properties", label: "Properties" },
  { href: "/dashboard/open-houses", label: "Open Houses" },
  { href: "/dashboard/contacts", label: "Contacts" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/presentations", label: "Presentations" },
  { href: "/dashboard/comparison-report", label: "AI Comparison Report" },
  { href: "/dashboard/tools", label: "Tools" },
  { href: "/dashboard/marketing", label: "Marketing" },
  { href: "/dashboard/growth", label: "Growth" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await (async () => {
    try {
      return await getCurrentAgentContext();
    } catch (e: any) {
      if (e?.message === "Not authenticated") {
        redirect("/login?redirect=/dashboard");
      }
      throw e;
    }
  })();

  // Feature gating: dashboard requires active/trialing subscription.
  try {
    const { data } = await supabaseServer
      .from("user_profiles")
      .select("subscription_status,trial_ends_at")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    let status = String((data as any)?.subscription_status ?? "").toLowerCase();
    const trialEndsAt = (data as any)?.trial_ends_at
      ? new Date(String((data as any).trial_ends_at))
      : null;
    if (status === "trialing" && trialEndsAt && trialEndsAt.getTime() <= Date.now()) {
      status = "inactive";
      await supabaseServer
        .from("user_profiles")
        .update({ plan: "free", subscription_status: "inactive" } as any)
        .eq("user_id", ctx.userId);
    }
    if (status && !["active", "trialing"].includes(status)) {
      redirect("/pricing");
    }
  } catch {
    // If profiles/status isn't available yet, don't block dashboard rendering.
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar email={ctx?.email} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-3">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
                Navigation
              </div>
              <nav className="space-y-1">
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-700"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </aside>

          <section className="lg:col-span-9">{children}</section>
        </div>
      </div>
    </div>
  );
}

