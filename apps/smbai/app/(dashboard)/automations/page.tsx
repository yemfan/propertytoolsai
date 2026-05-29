import type { Metadata } from "next";
import { Zap } from "lucide-react";
import { listAutomationRules } from "@/lib/actions/automations";
import { AutomationsList } from "./automations-list";

export const metadata: Metadata = { title: "Automations · HelmSmart" };

export default async function AutomationsPage() {
  const rules = await listAutomationRules();

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Zap className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Automations</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Trigger automatic actions when business events occur
            </p>
          </div>
        </div>
      </div>

      <AutomationsList initialRules={rules} />
    </div>
  );
}
