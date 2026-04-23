import { requireRolePage } from "@/lib/auth/requireRolePage";
import { getToolFunnel, toolLabel } from "@/lib/adminFunnel/service";

export const dynamic = "force-dynamic";

/**
 * Admin tool-funnel dashboard. For each calculator this week:
 *   - how many times was it used (from `*_used` events)
 *   - how many lead captures came from it (from `tool_lead_capture`)
 *   - how many saves were created (from `saved_tool_results`)
 *   - derived conversion percentages
 *
 * Purely a reporting view — no writes. Use the ?days=N query param to
 * change the window (default 7).
 */
type SearchParams = Promise<{ days?: string }>;

export default async function AdminToolFunnelPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRolePage(["admin"]);

  const sp = await searchParams;
  const sinceDays = Math.max(
    1,
    Math.min(90, Number(sp?.days) || 7),
  );
  const { sinceIso, rows } = await getToolFunnel({ sinceDays });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Tool funnel</h1>
      <p className="mt-2 text-sm text-slate-600">
        Calculator usage → lead captures → saved scenarios. Window:{" "}
        <strong>last {sinceDays} days</strong>. Data since{" "}
        {new Date(sinceIso).toLocaleDateString()}.
      </p>

      <div className="mt-4 flex items-center gap-2 text-xs">
        <span className="text-slate-500">Window:</span>
        {[1, 7, 30, 90].map((d) => (
          <a
            key={d}
            href={`?days=${d}`}
            className={`rounded-full px-3 py-1 font-medium transition-colors ${
              d === sinceDays
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {d === 1 ? "24h" : `${d}d`}
          </a>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Tool</th>
              <th className="px-3 py-2 text-right font-medium">Uses</th>
              <th className="px-3 py-2 text-right font-medium">Leads</th>
              <th className="px-3 py-2 text-right font-medium">Lead %</th>
              <th className="px-3 py-2 text-right font-medium">Saves</th>
              <th className="px-3 py-2 text-right font-medium">Save %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-500">
                  No events recorded in this window.
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.tool} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-900">
                  {toolLabel(r.tool)}
                  <div className="text-[11px] text-slate-500">{r.tool}</div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                  {r.usedCount.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                  {r.leadCount.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.leadConversionPct == null ? (
                    <span className="text-slate-300">—</span>
                  ) : (
                    <span
                      className={
                        r.leadConversionPct >= 5
                          ? "font-semibold text-green-700"
                          : r.leadConversionPct >= 1
                            ? "text-slate-700"
                            : "text-slate-400"
                      }
                    >
                      {r.leadConversionPct.toFixed(1)}%
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                  {r.saveCount.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.saveConversionPct == null ? (
                    <span className="text-slate-300">—</span>
                  ) : (
                    <span className="text-slate-700">
                      {r.saveConversionPct.toFixed(1)}%
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        <strong>Uses</strong> counts every calculator mount fire
        (<code>*_used</code> events). <strong>Leads</strong> counts the{" "}
        <code>tool_lead_capture</code> event from the
        &quot;Unlock&quot; form. <strong>Saves</strong> counts inserts
        into <code>saved_tool_results</code>. Conversion % = step / uses.
      </p>
    </div>
  );
}
