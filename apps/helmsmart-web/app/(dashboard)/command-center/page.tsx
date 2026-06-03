import type { Metadata } from "next";
import { getWorkforceSummary } from "@/lib/actions/workforce";
import { WorkforceBoard } from "./workforce-board";

export const metadata: Metadata = { title: "Command Center" };

export default async function CommandCenterPage() {
  // Last 30 days (inclusive).
  const today = new Date();
  const from = new Date(today.getTime() - 29 * 86_400_000);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = today.toISOString().slice(0, 10);

  const summary = await getWorkforceSummary(fromStr, toStr);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Command Center</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Your AI workforce at a glance — what each employee did over the last 30 days
        </p>
      </div>

      <WorkforceBoard summary={summary} />
    </div>
  );
}
