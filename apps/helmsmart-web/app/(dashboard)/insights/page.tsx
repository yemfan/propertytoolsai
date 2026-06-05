import type { Metadata } from "next";
import { getLatestInsight, listInsights } from "@/lib/actions/business-insights";
import { TimInsights } from "@/components/tim-insights";
import type { InsightItem } from "@/lib/business-insights";

export const metadata: Metadata = { title: "Business Insights · Tim" };

export default async function InsightsPage() {
  const [latest, history] = await Promise.all([
    getLatestInsight(),
    listInsights(12),
  ]);

  // History excludes the latest (shown in the main card)
  const past = latest
    ? history.filter((h) => h.period_start !== latest.periodStart)
    : history;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Business Insights</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Weekly intelligence from Tim, your AI Chief Information Officer
        </p>
      </div>

      <TimInsights initialInsight={latest} />

      {/* History */}
      {past.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Past digests</h2>
          <div className="space-y-3">
            {past.map((h) => {
              const items = (h.insights ?? []) as InsightItem[];
              return (
                <div key={h.id} className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-slate-900">{h.headline}</p>
                    <span className="text-xs text-slate-400 flex-shrink-0 ml-3">
                      {new Date(h.period_start + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {" – "}
                      {new Date(h.period_end + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{h.summary}</p>
                  {items.length > 0 && (
                    <p className="text-xs text-slate-400 mt-2">{items.length} insight{items.length !== 1 ? "s" : ""}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
