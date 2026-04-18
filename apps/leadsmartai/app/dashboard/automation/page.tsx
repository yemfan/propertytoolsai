import { AutomationProGate } from "@/components/funnel/AutomationProGate";
import { ReengagementPanel } from "@/components/crm/ReengagementPanel";
import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import { fetchUserPortalContext } from "@/lib/rolePortalServer";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Automation",
  description: "Automate lead follow-ups and re-engagement campaigns.",
  keywords: ["automation", "lead follow-up", "drip campaigns"],
  robots: { index: false },
};

export default async function AutomationPage() {
  await getCurrentAgentContext(); // auth guard via dashboard layout

  const supabaseAuth = supabaseServerClient();
  const portalCtx = await fetchUserPortalContext(supabaseAuth);
  const isAdmin = String(portalCtx?.role ?? "").toLowerCase() === "admin";

  const { data: rules } = await supabaseServer
    .from("automation_rules")
    .select("id,name,trigger_type,active,condition,created_at")
    .order("created_at", { ascending: false });

  const { data: logs } = await supabaseServer
    .from("automation_logs")
    .select("id,contact_id,rule_id,message,status,created_at,rule:rule_id (name)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Automation Activity</h1>
        <p className="text-sm text-slate-600">
          Automated follow-ups triggered by lead behavior and engagement.
        </p>
      </div>

      <AutomationProGate />

      <ReengagementPanel isAdmin={isAdmin} />

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-3">
        <div className="text-sm font-semibold text-slate-900">Rules</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(rules as any[])?.map((r) => (
            <form
              key={r.id}
              action={`/api/dashboard/automation/rules/${r.id}`}
              method="post"
              className="border border-slate-200 rounded-xl p-4 bg-slate-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{r.name}</div>
                  <div className="text-xs text-slate-600">
                    Trigger: <span className="font-semibold">{r.trigger_type}</span>
                  </div>
                </div>
                <input type="hidden" name="active" value={r.active ? "0" : "1"} />
                <button
                  type="submit"
                  className={`text-xs font-semibold px-3 py-2 rounded-lg border ${
                    r.active
                      ? "bg-white border-slate-300 text-slate-800 hover:bg-slate-100"
                      : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {r.active ? "Disable" : "Enable"}
                </button>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                Condition: {JSON.stringify(r.condition ?? {})}
              </div>
            </form>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="text-sm font-semibold text-slate-900">Recent messages</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">When</th>
                <th className="text-left px-4 py-3 font-semibold">Lead</th>
                <th className="text-left px-4 py-3 font-semibold">Rule</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Message</th>
              </tr>
            </thead>
            <tbody>
              {(logs as any[])?.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {l.created_at ? new Date(l.created_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3">{String(l.contact_id)}</td>
                  <td className="px-4 py-3">{(l.rule as any)?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold">
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-xl">
                    <div className="line-clamp-3 whitespace-pre-line">{l.message}</div>
                  </td>
                </tr>
              ))}
              {!(logs as any[])?.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-slate-600">
                    No automation messages yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

