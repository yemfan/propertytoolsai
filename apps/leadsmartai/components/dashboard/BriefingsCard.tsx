"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

type BriefingInsights = {
  topHotLeads?: Array<{ name: string; score: number; address: string }>;
  needsFollowUp?: Array<{ name: string; daysInactive: number; address: string }>;
  completedTasks?: Array<{ title: string; type: string }>;
  missedTasks?: Array<{ title: string; type: string }>;
  tomorrowTasks?: Array<{ title: string; type: string }>;
  topOpportunity?: string;
  suggestedActions?: string[];
};

type BriefingRow = {
  id: string;
  kind: "morning" | "evening";
  headline: string | null;
  summary: string;
  insights: BriefingInsights;
  created_at: string;
};

type ApiResponse = {
  ok: boolean;
  morning?: BriefingRow[];
  evening?: BriefingRow[];
};

/**
 * Two side-by-side briefing cards on the dashboard:
 *   - Morning briefing (☀️ start-of-day plan)
 *   - Evening summary (🌙 end-of-day recap)
 *
 * Desktop: horizontal grid + previous/next pagers to roll through
 * the last 7 of each kind. Mobile: only the latest of each, stacked,
 * with no pager — keeps the small screen focused on what matters
 * right now.
 *
 * Empty state: when an agent hasn't received their first briefing
 * yet (cron hasn't fired or hasn't hit their morning_time window),
 * we show a soft "your first briefing arrives soon" placeholder
 * rather than a blank rectangle.
 */
export default function BriefingsCard() {
  const [morning, setMorning] = useState<BriefingRow[]>([]);
  const [evening, setEvening] = useState<BriefingRow[]>([]);
  const [morningIdx, setMorningIdx] = useState(0);
  const [eveningIdx, setEveningIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/dashboard/briefings");
      const json = (await res.json()) as ApiResponse;
      if (!json.ok) {
        setErr("Could not load briefings.");
        return;
      }
      setMorning(json.morning ?? []);
      setEvening(json.evening ?? []);
    } catch {
      setErr("Could not load briefings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section
      aria-label="Daily briefings"
      className="grid gap-4 sm:grid-cols-2"
    >
      <BriefingPane
        kind="morning"
        list={morning}
        idx={morningIdx}
        setIdx={setMorningIdx}
        loading={loading}
        error={err}
      />
      <BriefingPane
        kind="evening"
        list={evening}
        idx={eveningIdx}
        setIdx={setEveningIdx}
        loading={loading}
        error={err}
      />
    </section>
  );
}

function BriefingPane({
  kind,
  list,
  idx,
  setIdx,
  loading,
  error,
}: {
  kind: "morning" | "evening";
  list: BriefingRow[];
  idx: number;
  setIdx: (i: number) => void;
  loading: boolean;
  error: string | null;
}) {
  const isMorning = kind === "morning";
  const accent = isMorning ? "amber" : "indigo";
  const palette = useMemo(() => paletteFor(accent), [accent]);
  const current = list[idx] ?? null;
  const total = list.length;
  const showPager = total > 1;

  const title = isMorning ? "Morning Briefing" : "Evening Summary";
  const emojiBadge = isMorning ? "☀️" : "🌙";

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border ${palette.border} ${palette.bg} p-5 shadow-sm`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${palette.badgeBg} text-xl`} aria-hidden>
            {emojiBadge}
          </span>
          <div>
            <h3 className={`text-sm font-semibold ${palette.title}`}>{title}</h3>
            <p className="text-[11px] text-slate-500">
              {current ? formatRelativeDate(current.created_at) : "Awaiting first run"}
            </p>
          </div>
        </div>
        {showPager ? (
          <nav
            className="hidden items-center gap-1 sm:flex"
            aria-label={`${title} history`}
          >
            <button
              type="button"
              disabled={idx >= total - 1}
              onClick={() => setIdx(Math.min(total - 1, idx + 1))}
              className="rounded-md p-1 text-slate-400 transition hover:text-slate-700 disabled:opacity-30"
              aria-label="Older briefing"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.2} />
            </button>
            <span className="text-[11px] tabular-nums text-slate-500">
              {idx + 1}/{total}
            </span>
            <button
              type="button"
              disabled={idx <= 0}
              onClick={() => setIdx(Math.max(0, idx - 1))}
              className="rounded-md p-1 text-slate-400 transition hover:text-slate-700 disabled:opacity-30"
              aria-label="Newer briefing"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </nav>
        ) : null}
      </header>

      <div className="mt-4 min-h-[7rem]">
        {loading ? (
          <SkeletonBody />
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : !current ? (
          <EmptyBriefing kind={kind} />
        ) : (
          <BriefingBody row={current} palette={palette} />
        )}
      </div>
    </article>
  );
}

function BriefingBody({
  row,
  palette,
}: {
  row: BriefingRow;
  palette: ReturnType<typeof paletteFor>;
}) {
  const insights = row.insights ?? {};
  const headline = row.headline?.trim() || row.summary.split(/[.!?]\s/)[0] || "";
  const highlights = pickHighlights(row);

  return (
    <>
      <p className={`text-base font-semibold leading-snug ${palette.headline}`}>
        {headline}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{row.summary}</p>

      {highlights.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
          {highlights.map((h, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 text-base leading-none">{h.icon}</span>
              <span>{h.text}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {insights.topOpportunity ? (
        <div className={`mt-4 rounded-lg ${palette.callout} p-3`}>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
            <Sparkles className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            Best move
          </p>
          <p className="mt-1 text-sm leading-snug">{insights.topOpportunity}</p>
        </div>
      ) : null}
    </>
  );
}

function EmptyBriefing({ kind }: { kind: "morning" | "evening" }) {
  const text =
    kind === "morning"
      ? "Your first morning plan arrives at your scheduled time. ☀️"
      : "Your first evening recap arrives after the day winds down. 🌙";
  return (
    <p className="text-sm leading-relaxed text-slate-500">{text}</p>
  );
}

function SkeletonBody() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-4 w-3/4 rounded bg-slate-200" />
      <div className="h-3 w-full rounded bg-slate-100" />
      <div className="h-3 w-5/6 rounded bg-slate-100" />
      <div className="mt-3 h-12 w-full rounded bg-slate-100" />
    </div>
  );
}

/**
 * Turn the briefing's structured insights into 2-3 bulleted "highlight"
 * lines for the card body. Keeps the card scannable without dumping
 * the entire JSON back at the user.
 */
function pickHighlights(row: BriefingRow): Array<{ icon: string; text: string }> {
  const out: Array<{ icon: string; text: string }> = [];
  const i = row.insights ?? {};
  if (row.kind === "morning") {
    const hot = i.topHotLeads ?? [];
    if (hot.length) {
      out.push({
        icon: "🔥",
        text: `${hot.length} hot lead${hot.length === 1 ? "" : "s"} ready: ${hot.slice(0, 2).map((h) => h.name).join(", ")}${hot.length > 2 ? ", …" : ""}`,
      });
    }
    const stale = i.needsFollowUp ?? [];
    if (stale.length) {
      out.push({
        icon: "💤",
        text: `${stale.length} lead${stale.length === 1 ? "" : "s"} gone quiet 7+ days`,
      });
    }
  } else {
    const done = i.completedTasks ?? [];
    if (done.length) {
      out.push({
        icon: "✅",
        text: `${done.length} task${done.length === 1 ? "" : "s"} cleared today`,
      });
    }
    const missed = i.missedTasks ?? [];
    if (missed.length) {
      out.push({
        icon: "↪️",
        text: `${missed.length} rolling over to tomorrow`,
      });
    }
    const tomorrow = i.tomorrowTasks ?? [];
    if (tomorrow.length) {
      out.push({
        icon: "📅",
        text: `${tomorrow.length} queued for tomorrow`,
      });
    }
  }
  return out.slice(0, 3);
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((today.getTime() - date.setHours(0, 0, 0, 0)) / dayMs);
  const t = new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diffDays <= 0) return `Today, ${t}`;
  if (diffDays === 1) return `Yesterday, ${t}`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function paletteFor(accent: "amber" | "indigo") {
  if (accent === "amber") {
    return {
      border: "border-amber-200/80",
      bg: "bg-gradient-to-br from-amber-50/80 via-white to-white",
      badgeBg: "bg-amber-100",
      title: "text-amber-900",
      headline: "text-slate-900",
      callout: "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200",
    };
  }
  return {
    border: "border-indigo-200/80",
    bg: "bg-gradient-to-br from-indigo-50/80 via-white to-white",
    badgeBg: "bg-indigo-100",
    title: "text-indigo-900",
    headline: "text-slate-900",
    callout: "bg-indigo-50 text-indigo-900 ring-1 ring-inset ring-indigo-200",
  };
}
