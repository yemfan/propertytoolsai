import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentAgentContext, getLeads } from "@/lib/dashboardService";

type LeadLite = {
  id: string;
  name: string | null;
  email: string | null;
};

type NotificationRow = {
  id: string;
  lead_id: string | null;
  property_id: string | null;
  type: string;
  message: string;
  sent_at: string;
};

export default async function NotificationsPage() {
  await getCurrentAgentContext();

  // Best-effort: get recent lead IDs for this agent.
  // Note: `getLeads()` may be plan-limited for free agents.
  const leads = await getLeads({ limit: 500 });
  const leadIds = leads.map((l) => l.id);
  const leadMap = new Map<string, LeadLite>();
  leads.forEach((l) => leadMap.set(l.id, { id: l.id, name: l.name, email: l.email }));

  const notificationsRes = await supabaseServer
    .from("notifications")
    .select("id,lead_id,property_id,type,message,sent_at")
    .in("lead_id", leadIds.length ? leadIds : ["__none__"])
    .order("sent_at", { ascending: false })
    .limit(50);

  const notifications = (notificationsRes.data ?? []) as NotificationRow[];

  const propertyIds = Array.from(
    new Set(notifications.map((n) => n.property_id).filter(Boolean))
  ) as string[];

  const { data: propertiesData } = await supabaseServer
    .from("properties_warehouse")
    .select("id,address")
    .in("id", propertyIds.length ? propertyIds : ["__none__"]);

  const propertyMap = new Map<string, string>();
  (propertiesData ?? []).forEach((p: any) => propertyMap.set(String(p.id), String(p.address)));

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="ui-page-title text-brand-text">Notifications</h1>
          <p className="ui-page-subtitle text-brand-text/80">
            Nearby property activity alerts that have been sent to your leads.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="ui-table-header text-left px-4 py-3">Lead</th>
                <th className="ui-table-header text-left px-4 py-3">Type</th>
                <th className="ui-table-header text-left px-4 py-3">Property</th>
                <th className="ui-table-header text-left px-4 py-3">Sent</th>
              </tr>
            </thead>
            <tbody>
              {notifications.length ? (
                notifications.map((n) => (
                  <tr key={n.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="ui-table-cell px-4 py-3">
                      <div className="ui-card-title text-brand-text">{leadMap.get(n.lead_id ?? "")?.name ?? "—"}</div>
                      <div className="ui-meta text-slate-500">{leadMap.get(n.lead_id ?? "")?.email ?? ""}</div>
                    </td>
                    <td className="ui-table-cell px-4 py-3">
                      <span
                        className={
                          n.type === "sold"
                            ? "inline-flex items-center px-2 py-0.5 rounded-full bg-brand-surface border border-green-200 text-brand-success text-xs font-semibold"
                            : "inline-flex items-center px-2 py-0.5 rounded-full bg-brand-surface border border-blue-200 text-brand-primary text-xs font-semibold"
                        }
                      >
                        {n.type}
                      </span>
                    </td>
                    <td className="ui-table-cell px-4 py-3">
                      {n.property_id ? propertyMap.get(n.property_id) ?? n.property_id : "—"}
                    </td>
                    <td className="ui-table-cell px-4 py-3 text-slate-600 whitespace-nowrap">
                      {new Date(n.sent_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-sm text-slate-600">
                    No notifications sent yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

