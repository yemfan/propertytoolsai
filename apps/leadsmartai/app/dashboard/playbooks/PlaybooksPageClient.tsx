"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PlaybooksPanel } from "@/components/dashboard/PlaybooksPanel";
import type { PlaybookTaskRow } from "@/lib/playbooks/types";

/**
 * Cross-anchor "my checklists" view.
 *
 * Top strip: today / this-week / overdue / done-today counters so
 * the agent can see their load at a glance. Below: the generic
 * PlaybooksPanel for bare-date checklists. Agents apply entity-
 * anchored playbooks from the transaction / open-house detail pages.
 */
export function PlaybooksPageClient() {
  const [all, setAll] = useState<PlaybookTaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/playbooks?all=1&includeCompleted=1");
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        tasks?: PlaybookTaskRow[];
      } | null;
      if (body?.ok && Array.isArray(body.tasks)) {
        setAll(body.tasks);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Poll on focus so completions from detail pages flow back here.
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const stats = useMemo(() => computeStats(all), [all]);

  const todayOpen = useMemo(
    () =>
      all
        .filter((t) => !t.completed_at && t.due_date && t.due_date <= todayYmd())
        .sort((a, b) =>
          (a.due_date ?? "").localeCompare(b.due_date ?? ""),
        ),
    [all],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">📋 Playbooks</h1>
        <p className="mt-1 text-sm text-slate-500">
          Curated checklists for common workflows. Apply them to transactions, open houses, or
          as standalone reminders.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Due today" value={String(stats.dueToday)} tone="blue" />
        <Stat label="Overdue" value={String(stats.overdue)} tone={stats.overdue > 0 ? "red" : "slate"} />
        <Stat label="This week" value={String(stats.thisWeek)} />
        <Stat label="Done (last 7d)" value={String(stats.doneRecent)} tone="green" />
      </div>

      {loading && all.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
          Loading…
        </div>
      ) : todayOpen.length ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Today / overdue</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Cross-anchor view. Complete items here or jump to the source.
          </p>
          <ul className="mt-3 divide-y divide-slate-100">
            {todayOpen.map((t) => (
              <li key={t.id} className="flex items-start gap-2 py-2">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={async (e) => {
                    if (!e.target.checked) return;
                    await fetch(`/api/dashboard/playbooks/${t.id}`, {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ completed: true }),
                    });
                    await load();
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <div className="flex-1">
                  <div className="text-sm text-slate-900">{t.title}</div>
                  {t.notes ? (
                    <div className="text-[11px] text-slate-500">{t.notes}</div>
                  ) : null}
                  <div className="mt-0.5 flex items-center gap-2 text-[11px]">
                    <span
                      className={
                        t.due_date && t.due_date < todayYmd()
                          ? "font-medium text-red-600"
                          : "text-slate-500"
                      }
                    >
                      Due {t.due_date ? formatYmd(t.due_date) : "—"}
                    </span>
                    <AnchorChip task={t} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Generic-anchor panel — agent can spin up a standalone playbook
          (e.g. "Write an offer" as a bare task list with no linked txn yet). */}
      <PlaybooksPanel anchorKind="generic" anchorId={null} />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "blue" | "green" | "red" | "slate";
}) {
  const color =
    tone === "blue"
      ? "text-blue-700"
      : tone === "green"
        ? "text-green-700"
        : tone === "red"
          ? "text-red-600"
          : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className={`text-xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function AnchorChip({ task }: { task: PlaybookTaskRow }) {
  if (task.anchor_kind === "transaction" && task.anchor_id) {
    return (
      <a
        href={`/dashboard/transactions/${task.anchor_id}`}
        className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700 hover:underline"
      >
        ↗ Transaction
      </a>
    );
  }
  if (task.anchor_kind === "open_house" && task.anchor_id) {
    return (
      <a
        href={`/dashboard/open-houses/${task.anchor_id}`}
        className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700 hover:underline"
      >
        ↗ Open house
      </a>
    );
  }
  return null;
}

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function formatYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function computeStats(all: PlaybookTaskRow[]): {
  dueToday: number;
  overdue: number;
  thisWeek: number;
  doneRecent: number;
} {
  const today = todayYmd();
  const weekFromNow = shiftYmd(today, 7);
  const weekAgo = shiftYmd(today, -7);
  let dueToday = 0;
  let overdue = 0;
  let thisWeek = 0;
  let doneRecent = 0;
  for (const t of all) {
    if (t.completed_at) {
      if (t.completed_at.slice(0, 10) >= weekAgo) doneRecent += 1;
      continue;
    }
    if (!t.due_date) continue;
    if (t.due_date === today) dueToday += 1;
    else if (t.due_date < today) overdue += 1;
    if (t.due_date >= today && t.due_date <= weekFromNow) thisWeek += 1;
  }
  return { dueToday, overdue, thisWeek, doneRecent };
}

function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
