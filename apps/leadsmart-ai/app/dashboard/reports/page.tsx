import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentAgentContext, getLeads } from "@/lib/dashboardService";

type LeadLite = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  property_address: string | null;
};

type ReportRow = {
  id: string;
  property_id: string;
  lead_id: string | null;
  created_at: string;
  report_data: any;
};

export default async function ReportsPage() {
  await getCurrentAgentContext();

  // Load a bounded set of leads so we can filter reports by agent without
  // relying on multi-table joins (which can vary with schema/RLS).
  const leads = await getLeads({ limit: 500 });
  const leadIds = leads.map((l) => l.id);
  const leadMap = new Map<string, LeadLite>();
  leads.forEach((l) =>
    leadMap.set(l.id, {
      id: l.id,
      name: l.name,
      email: l.email,
      phone: l.phone,
      property_address: l.property_address,
    })
  );

  let reports: ReportRow[] = [];
  let error: any = null;

  if (leadIds.length) {
    const res = await supabaseServer
      .from("reports")
      .select("id,property_id,lead_id,created_at,report_data")
      .in("lead_id", leadIds)
      .order("created_at", { ascending: false })
      .limit(50);

    reports = (res.data ?? []) as ReportRow[];
    error = res.error;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="ui-page-title text-brand-text">Reports</h1>
          <p className="ui-page-subtitle text-brand-text/80">View generated property reports (Estimator + CMA + rent).</p>
        </div>

        <Link
          href="/smart-cma-builder?save=1"
          className="inline-flex items-center justify-center rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#005ca8]"
        >
          Create New Report
        </Link>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          Failed to load reports.
        </div>
      ) : null}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="ui-table-header text-left px-4 py-3">Property</th>
                <th className="ui-table-header text-left px-4 py-3">Lead</th>
                <th className="ui-table-header text-left px-4 py-3">Date</th>
                <th className="ui-table-header text-left px-4 py-3">Report</th>
              </tr>
            </thead>
            <tbody>
              {reports.length ? (
                reports.map((r) => {
                  const lead = r.lead_id ? leadMap.get(r.lead_id) : undefined;
                  const propertyAddress =
                    r.report_data?.property?.address ||
                    r.report_data?.property?.address_line ||
                    r.report_data?.property?.addressLine ||
                    null;
                  const reportLink = `/report/${encodeURIComponent(r.id)}`;

                  return (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="ui-table-cell px-4 py-3">
                        <div className="ui-card-title text-brand-text">
                          {propertyAddress ?? "—"}
                        </div>
                      </td>
                      <td className="ui-table-cell px-4 py-3 text-slate-700">
                        {lead?.name ?? "—"}
                        <div className="ui-meta text-slate-500">
                          {lead?.email ?? lead?.phone ?? "—"}
                        </div>
                      </td>
                      <td className="ui-table-cell px-4 py-3 text-slate-600 whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={reportLink}
                          className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-sm text-slate-600">
                    No reports found yet.
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

