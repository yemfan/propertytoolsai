import { getCurrentAgentContext } from "@/lib/dashboardService";
import AgentAiSettingsPanel from "@/components/dashboard/AgentAiSettingsPanel";
import AgentVoiceSettingsPanel from "@/components/dashboard/AgentVoiceSettingsPanel";
import MlsCsvImportClient from "./MlsCsvImportClient";
import HomeValueSmartLinkCopyShare from "@/components/dashboard/HomeValueSmartLinkCopyShare";

export default async function SettingsPage() {
  const ctx = await getCurrentAgentContext();
  const widgetAgentKey = ctx.agentId || ctx.userId;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="ui-page-title text-brand-text">Settings</h1>
        <p className="ui-page-subtitle text-brand-text/80">
          AI assistant, voice, and tool configuration.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3">
        <div className="ui-card-title text-brand-text">AI assistant style</div>
        <AgentAiSettingsPanel />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3">
        <div className="ui-card-title text-brand-text">Phone assistant voice</div>
        <AgentVoiceSettingsPanel />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3">
        <div className="ui-card-title text-brand-text">
          Home Value Smart Link
        </div>
        <p className="text-xs text-gray-600">
          Share this link with homeowners to send them directly into your Home Value
          funnel. New leads will appear in your dashboard.
        </p>
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-gray-500">
            Link (relative)
          </label>
          <input
            readOnly
            value={`/home-value-widget?agentId=${ctx.agentId}`}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono bg-gray-50 text-gray-800"
          />
          <div className="mt-2">
            <HomeValueSmartLinkCopyShare relativePath={`/home-value-widget?agentId=${encodeURIComponent(widgetAgentKey)}`} />
          </div>
          <p className="text-[11px] text-gray-500">
            Prepend your live domain, e.g.{" "}
            <span className="font-mono text-gray-700">
              https://leadsmart-ai.com/home-value-widget?agentId={widgetAgentKey}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-2">
        <MlsCsvImportClient />
      </div>
    </div>
  );
}

