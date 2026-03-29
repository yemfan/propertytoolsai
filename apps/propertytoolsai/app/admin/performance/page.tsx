import { requireRolePage } from "@/lib/auth/requireRolePage";
import { PerformanceDashboard } from "@/components/admin/PerformanceDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPerformancePage() {
  await requireRolePage(["admin"]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Revenue performance</h1>
          <p className="mt-1 text-sm text-gray-600">
            Sources, funnels, and agents — lead volume, response speed, and attributed revenue.
          </p>
        </div>
        <PerformanceDashboard />
      </div>
    </div>
  );
}
