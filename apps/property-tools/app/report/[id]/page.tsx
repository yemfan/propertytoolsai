import Link from "next/link";
import { notFound } from "next/navigation";
import ReportEngagementTracker from "@/components/ReportEngagementTracker";
import { supabaseServer } from "@/lib/supabaseServer";

export default async function OpenHouseReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ lead_id?: string }>;
}) {
  const { id: reportId } = await params;
  const sp = searchParams != null ? await searchParams : {};
  const leadIdFromQuery = sp.lead_id ?? null;

  const { data, error } = await supabaseServer
    .from("reports")
    .select("id,lead_id,property_id,report_data,created_at")
    .eq("id", reportId)
    .maybeSingle();

  if (error) {
    console.error("Open house report load error", error);
    return notFound();
  }
  if (!data) return notFound();

  const report = (data.report_data ?? {}) as any;

  const estimatedValue = report?.estimated?.estimatedValue ?? null;
  const low = report?.estimated?.low ?? null;
  const high = report?.estimated?.high ?? null;
  const avgPricePerSqft = report?.estimated?.avgPricePerSqft ?? null;
  const summary = report?.estimated?.summary ?? "";

  const rentEstimate = report?.rent?.rentEstimate ?? null;
  const property = report?.property ?? {};
  const comps: any[] = Array.isArray(report?.comps) ? report.comps : [];

  const formatCurrency = (v: number | null) =>
    v == null || !Number.isFinite(v) ? "—" : `$${Math.round(v).toLocaleString()}`;

  const agentName = process.env.AGENT_BRAND_NAME || "PropertyTools AI";
  const agentEmail = process.env.AGENT_NOTIFICATION_EMAIL || "";

  return (
    <div className="min-h-screen bg-slate-50">
      <ReportEngagementTracker leadId={leadIdFromQuery} reportId={reportId} />
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Open House Property Report
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">
                {property?.address || "Property Report"}
              </h1>
              {property?.city || property?.state ? (
                <p className="text-sm text-slate-600 mt-1">
                  {[property?.city, property?.state].filter(Boolean).join(", ")}
                </p>
              ) : null}
            </div>
            <div className="text-xs text-slate-500">
              Generated{" "}
              {data?.created_at ? new Date(data.created_at).toLocaleDateString() : "—"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Estimated Home Value
            </div>
            <div className="text-3xl font-extrabold text-blue-700 mt-2">
              {formatCurrency(estimatedValue)}
            </div>
            <div className="text-sm text-slate-700 mt-1">
              Range: {formatCurrency(low)} – {formatCurrency(high)}
            </div>
            {avgPricePerSqft != null ? (
              <div className="text-xs text-slate-500 mt-2">
                Avg price/sqft: ${Number(avgPricePerSqft).toFixed(0).toLocaleString()}
              </div>
            ) : null}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Rental Estimate
            </div>
            <div className="text-3xl font-extrabold text-emerald-700 mt-2">
              {rentEstimate != null ? `$${Math.round(rentEstimate).toLocaleString()}` : "—"}
              <span className="text-base font-bold text-slate-600"> / mo</span>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Based on recent snapshot rent estimates.
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Property Snapshot
            </div>
            <div className="mt-3 text-sm text-slate-800 font-semibold">
              {[property?.beds, property?.baths, property?.sqft].some((x: any) => x != null) ? (
                <>
                  {property?.beds ?? "—"} Beds • {property?.baths ?? "—"} Baths •{" "}
                  {property?.sqft ? Number(property.sqft).toLocaleString() : "—"} Sqft
                </>
              ) : (
                "—"
              )}
            </div>
            {property?.propertyType || property?.yearBuilt ? (
              <div className="text-xs text-slate-500 mt-2">
                {property?.propertyType ? String(property.propertyType) : "—"}{" "}
                {property?.yearBuilt ? `• Built ${property.yearBuilt}` : ""}
              </div>
            ) : null}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900">CMA Highlights</h2>
          <p className="text-sm text-slate-600 mt-2">{summary || "—"}</p>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  <th className="px-3 py-2 font-semibold">Comp Address</th>
                  <th className="px-3 py-2 font-semibold">Sold</th>
                  <th className="px-3 py-2 font-semibold">Sqft</th>
                  <th className="px-3 py-2 font-semibold">Price/Sqft</th>
                  <th className="px-3 py-2 font-semibold">Sold Date</th>
                </tr>
              </thead>
              <tbody>
                {comps.length ? (
                  comps.slice(0, 8).map((c, idx) => (
                    <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 whitespace-nowrap">{c.address}</td>
                      <td className="px-3 py-2">
                        {c.price != null ? `$${Math.round(c.price).toLocaleString()}` : "—"}
                      </td>
                      <td className="px-3 py-2">{c.sqft ? Number(c.sqft).toLocaleString() : "—"}</td>
                      <td className="px-3 py-2">
                        {c.pricePerSqft != null ? `$${Number(c.pricePerSqft).toFixed(0)}` : "—"}
                      </td>
                      <td className="px-3 py-2">{c.soldDate || "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-slate-600">
                      No comparable sold data available yet. Import MLS sold history to improve accuracy.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-blue-900">Next Steps</h2>
              <p className="text-sm text-blue-900/80 mt-1">
                Want the full analysis and pricing strategy for your open house? Request a personalized CMA.
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/smart-cma-builder"
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Request Full CMA
              </Link>
              {agentEmail ? (
                <a
                  href={`mailto:${encodeURIComponent(agentEmail)}?subject=${encodeURIComponent(
                    "Schedule Consultation"
                  )}`}
                  className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-800 border border-blue-200 hover:bg-blue-100"
                >
                  Schedule Consultation
                </a>
              ) : (
                <span className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-400 border border-blue-200">
                  Schedule Consultation
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500 pb-12">
          This report is informational and may not reflect all local market factors. Always verify details with a licensed professional.
          <div className="mt-2">
            {agentName}
            {agentEmail ? ` • ${agentEmail}` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

