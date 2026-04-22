import type { Metadata } from "next";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import AgentAiSettingsPanel from "@/components/dashboard/AgentAiSettingsPanel";
import AgentVoiceSettingsPanel from "@/components/dashboard/AgentVoiceSettingsPanel";
import ChannelsCard from "@/components/dashboard/ChannelsCard";
import ComplianceCard from "@/components/dashboard/ComplianceCard";
import { TransactionNotificationsPanel } from "@/components/dashboard/TransactionNotificationsPanel";
import HomeValueSmartLinkCopyShare from "@/components/dashboard/HomeValueSmartLinkCopyShare";
import ReviewPolicyPanel from "@/components/dashboard/ReviewPolicyPanel";
import SettingsTabsClient from "@/components/dashboard/SettingsTabsClient";
import TemplatesSummaryCard from "@/components/dashboard/TemplatesSummaryCard";
import TimingPanel from "@/components/dashboard/TimingPanel";
import MlsCsvImportClient from "./MlsCsvImportClient";

export const metadata: Metadata = {
  title: "Settings",
  description: "Configure your account, AI preferences, and integrations.",
  keywords: ["settings", "account", "preferences"],
  robots: { index: false },
};

export default async function SettingsPage() {
  const ctx = await getCurrentAgentContext();
  const widgetAgentKey = ctx.agentId || ctx.userId;

  return (
    <div className="mx-auto max-w-3xl">
      <SettingsTabsClient
        voice={
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
        }
        messages={
          <>
            <Card
              title="Review Policy"
              description="Control whether messages send automatically when triggers fire, or wait for your approval first. The most important setting in Messages — it affects every template across every channel."
            >
              <ReviewPolicyPanel />
            </Card>

            <TemplatesSummaryCard agentId={ctx.agentId} />

            <Card
              title="Timing &amp; Frequency"
              description="Rules that apply across every template. These override any template-level settings — the most restrictive rule always wins."
            >
              <TimingPanel />
            </Card>
          </>
        }
        tools={
          <>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">Home Value Smart Link</h2>
              <p className="mt-0.5 text-xs text-gray-500 mb-3">
                Share with homeowners to route them into your funnel.
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={`/home-value-widget?agentId=${ctx.agentId}`}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono bg-gray-50 text-gray-700"
                />
              </div>
              <div className="mt-2">
                <HomeValueSmartLinkCopyShare
                  relativePath={`/home-value-widget?agentId=${encodeURIComponent(widgetAgentKey)}`}
                />
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">MLS Data Import</h2>
              <MlsCsvImportClient />
            </div>
          </>
        }
        channels={
          <>
            <ChannelsCard agentId={ctx.agentId} />
            <Card
              title="Transaction Coordinator notifications"
              description="Delivery preferences for deal-level nudges: daily email digest of overdue tasks, plus a closing-window wire-fraud SMS escalation."
            >
              <TransactionNotificationsPanel />
            </Card>
            <ComplianceCard />
          </>
        }
      />
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-gray-500 mb-3">{description}</p>}
      {children}
    </div>
  );
}
