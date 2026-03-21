import { getCurrentAgentContext } from "@/lib/dashboardService";
import MlsCsvImportClient from "./MlsCsvImportClient";

export default async function SettingsPage() {
  const ctx = await getCurrentAgentContext();
  const agentBrandName = process.env.AGENT_BRAND_NAME || "LeadSmart AI";
  const derivedName = ctx.email ? ctx.email.split("@")[0] : ctx.agentId;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="ui-page-title text-brand-text">Settings</h1>
        <p className="ui-page-subtitle text-brand-text/80">
          Account and subscription information.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <div className="ui-card-title text-brand-text mb-2">
          Subscription
        </div>
        <dl className="text-sm text-gray-700 space-y-2">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Plan type</dt>
            <dd className="font-semibold">{ctx.planType}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Agent ID</dt>
            <dd className="font-mono text-xs">{ctx.agentId}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">User ID</dt>
            <dd className="font-mono text-xs">{ctx.userId}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-gray-500">
          Free plan is limited to 20 lead rows. Upgrade logic can be enforced
          in the data layer and RLS policies later.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3">
        <div className="ui-card-title text-brand-text">Agent Profile</div>
        <dl className="text-sm text-gray-700 space-y-2">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Name</dt>
            <dd className="font-semibold">{derivedName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Email</dt>
            <dd className="font-mono text-xs">{ctx.email ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Phone</dt>
            <dd className="text-gray-600">Not collected yet</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3">
        <div className="ui-card-title text-brand-text">Branding (Email Signature)</div>
        <p className="text-xs text-gray-600">
          This name is used in Resend email bodies (open house / follow-ups).
        </p>
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-gray-500">
            Branding Name
          </label>
          <input
            readOnly
            value={agentBrandName}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono bg-gray-50 text-gray-800"
          />
          <p className="text-[11px] text-gray-500">
            Set this via server env var <span className="font-mono">AGENT_BRAND_NAME</span>.
          </p>
        </div>
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
          <p className="text-[11px] text-gray-500">
            Prepend your live domain, e.g.{" "}
            <span className="font-mono text-gray-700">
              https://leadsmart-ai.com/home-value-widget?agentId={ctx.agentId}
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

