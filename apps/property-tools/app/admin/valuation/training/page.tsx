import { ValuationTrainingExportPanel } from "@/components/admin/ValuationTrainingExportPanel";
import { requireRolePage } from "@/lib/auth/requireRolePage";

export const dynamic = "force-dynamic";

export default async function ValuationTrainingExportPage() {
  await requireRolePage(["admin"]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Valuation ML training data</h1>
        <p className="mt-2 text-sm text-gray-600">
          Export labeled outcomes for model training. Rows require <code className="rounded bg-gray-100 px-1">actual_sale_price</code>{" "}
          on the underlying run.
        </p>
      </div>
      <ValuationTrainingExportPanel />
    </div>
  );
}
