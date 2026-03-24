import { redirect } from "next/navigation";
import { getCurrentUserWithProfile } from "@/lib/auth/getCurrentUser";

export const dynamic = "force-dynamic";

/** Default landing for `consumer` (and unknown) roles from `/dashboard`. */
export default async function PropertyToolsConsumerDashboardPage() {
  const ctx = await getCurrentUserWithProfile();
  if (!ctx) {
    redirect("/login?redirect=/propertytools/dashboard");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0072ce]">PropertyTools AI</p>
        <h1 className="mt-1 font-heading text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">
          Signed in as <span className="font-medium text-slate-900">{ctx.profile.email ?? ctx.user.email}</span>. Replace
          this page with your consumer home (saved tools, reports, etc.).
        </p>
      </div>
    </div>
  );
}
