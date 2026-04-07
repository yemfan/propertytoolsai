import { getCurrentAgentContext } from "@/lib/dashboardService";
import AgentAiSettingsPanel from "@/components/dashboard/AgentAiSettingsPanel";
import AgentVoiceSettingsPanel from "@/components/dashboard/AgentVoiceSettingsPanel";
import MlsCsvImportClient from "./MlsCsvImportClient";
import HomeValueSmartLinkCopyShare from "@/components/dashboard/HomeValueSmartLinkCopyShare";

export default async function SettingsPage() {
  const ctx = await getCurrentAgentContext();
  const widgetAgentKey = ctx.agentId || ctx.userId;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-0.5 text-sm text-gray-500">AI assistant, voice, and tools.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">
        <div className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">AI Assistant Style</h2>
          <AgentAiSettingsPanel />
        </div>
        <div className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Phone Voice</h2>
          <AgentVoiceSettingsPanel />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Home Value Smart Link</h2>
        <p className="mt-0.5 text-xs text-gray-500 mb-3">Share with homeowners to route them into your funnel.</p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={`/home-value-widget?agentId=${ctx.agentId}`}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono bg-gray-50 text-gray-700"
          />
        </div>
        <div className="mt-2">
          <HomeValueSmartLinkCopyShare relativePath={`/home-value-widget?agentId=${encodeURIComponent(widgetAgentKey)}`} />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">MLS Data Import</h2>
        <MlsCsvImportClient />
      </div>
    </div>
  );
}
