import { cookies } from "next/headers";
import PerformanceSelfTestButton from "@/components/dashboard/PerformanceSelfTestButton";

async function fetchWithAuth(path: string) {
  const cookieHeader = (await cookies())
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");

  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ""}${path}`, {
    cache: "no-store",
    headers: {
      cookie: cookieHeader,
    },
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

export default async function PerformancePage() {
  const [{ json: summary }, { json: trends }] = await Promise.all([
    fetchWithAuth("/api/performance/summary"),
    fetchWithAuth("/api/performance/trends"),
  ]);

  const metrics = summary?.metrics ?? {};
  const alerts: string[] = summary?.alerts ?? [];
  const days: any[] = trends?.days ?? [];

  const productivity = metrics.productivity ?? {};
  const leads = metrics.leads ?? {};
  const response = metrics.response ?? {};
  const conversion = metrics.conversion ?? {};
  const missed = metrics.missedOpportunities ?? {};

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="ui-page-title text-brand-text">Performance</h1>
        <p className="ui-page-subtitle text-brand-text/80">
          See how your tasks, leads, and engagement are trending over time.
        </p>
      </div>

      <PerformanceSelfTestButton />

      {alerts.length ? (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-accent"
            >
              {a}
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-1">
          <div className="ui-card-subtitle text-slate-500">
            Tasks completed (7 days)
          </div>
          <div className="mt-1 text-3xl font-extrabold text-brand-success">
            {productivity.tasksCompleted ?? 0}
          </div>
          <div className="text-xs text-slate-500">
            Skipped: <span className="font-semibold">{productivity.tasksSkipped ?? 0}</span>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-1">
          <div className="ui-card-subtitle text-slate-500">
            Task completion rate
          </div>
          <div className="mt-1 text-3xl font-extrabold text-brand-text">
            {(productivity.completionRate ?? 0).toString()}%
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-1">
          <div className="ui-card-subtitle text-slate-500">
            High engagement leads
          </div>
          <div className="mt-1 text-3xl font-extrabold text-brand-text">
            {leads.highEngagementLeads ?? 0}
          </div>
          <div className="text-xs text-slate-500">
            Total leads: <span className="font-semibold">{leads.totalLeads ?? 0}</span>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-1">
          <div className="ui-card-subtitle text-slate-500">
            Avg response time
          </div>
          <div className="mt-1 text-3xl font-extrabold text-brand-text">
            {response.avgMinutes != null ? `${response.avgMinutes}m` : "—"}
          </div>
          <div className="text-xs text-slate-500">
            Fastest:{" "}
            <span className="font-semibold">
              {response.fastestMinutes != null ? `${response.fastestMinutes}m` : "—"}
            </span>{" "}
            · Slowest:{" "}
            <span className="font-semibold">
              {response.slowestMinutes != null ? `${response.slowestMinutes}m` : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="ui-card-title text-brand-text">
              Engagement over time
            </div>
            <div className="text-xs text-slate-500">Last 14 days</div>
          </div>
          <div className="h-32 flex items-end gap-1">
            {days.map((d) => (
              <div
                key={d.date}
                className="flex-1 flex flex-col items-center gap-1 group"
              >
                <div
                  className="w-full rounded-t-md bg-brand-primary group-hover:bg-[#005ca8] transition-all"
                  style={{
                    height: `${Math.min(
                      100,
                      (d.engagementEvents || 0) * 6
                    )}px`,
                  }}
                />
                <span className="text-[10px] text-slate-400">
                  {d.date.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="ui-card-title text-brand-text">
              Task completion (done vs skipped)
            </div>
            <div className="text-xs text-slate-500">Last 14 days</div>
          </div>
          <div className="h-32 flex items-end gap-1">
            {days.map((d) => {
              const total = (d.tasksDone || 0) + (d.tasksSkipped || 0);
              const doneHeight = total ? (d.tasksDone || 0) / total : 0;
              const skipHeight = total ? (d.tasksSkipped || 0) / total : 0;
              return (
                <div
                  key={d.date}
                  className="flex-1 flex flex-col items-center gap-1 group"
                >
                  <div className="w-full h-24 flex flex-col justify-end gap-[1px]">
                    <div
                      className="w-full bg-brand-success group-hover:bg-green-700 rounded-t-md"
                      style={{ height: `${doneHeight * 96}px` }}
                    />
                    <div
                      className="w-full bg-brand-accent group-hover:bg-orange-500 rounded-b-md"
                      style={{ height: `${skipHeight * 96}px` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {d.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-2">
          <div className="ui-card-title text-brand-text">Conversion insight</div>
          <p className="text-xs text-slate-600">
            High-engagement leads (score &gt; 70):{" "}
            <span className="font-semibold">{conversion.highScoreLeads ?? 0}</span>.{" "}
            {conversion.highScoreLeads
              ? `You engaged with ${conversion.highScoreRespondedPct ?? 0}% of them.`
              : "Engage with more leads to see patterns."}
          </p>
          <p className="text-xs text-slate-700">
            🔥 High engagement leads typically convert much better. Focus your next outreach
            block on these contacts first.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-2">
          <div className="ui-card-title text-brand-text">Missed opportunities</div>
          <p className="text-xs text-slate-600">
            Hot leads with no action in 24h:{" "}
            <span className="font-semibold">{missed.hotNoAction24h ?? 0}</span>.
          </p>
          <p className="text-xs text-slate-700">
            ⚠️ Aim to respond to new hot leads within a few hours to maximize your chances
            of converting them before they move on.
          </p>
        </div>
      </div>
    </div>
  );
}

