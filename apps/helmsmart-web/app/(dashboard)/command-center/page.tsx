import type { Metadata } from "next";
import { getWorkforceSummary } from "@/lib/actions/workforce";
import { CommandCenterView } from "./command-center-view";
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
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Command Center</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Your business at a glance — AI workforce activity and department health over the last 30 days
        </p>
      </div>

      <CommandCenterView summary={summary} />

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">AI Workforce</h2>
        <WorkforceBoard summary={summary} />
      </div>
    </div>
  );
}
