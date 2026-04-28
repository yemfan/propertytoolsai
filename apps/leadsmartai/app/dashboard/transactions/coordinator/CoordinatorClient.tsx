"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  CoordinatorBoard,
  CoordinatorStageColumn,
  CoordinatorTransactionCard,
} from "@/lib/transactions/coordinator/grouping";

function formatMoney(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDateShort(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

function daysFromTodayLabel(iso: string | null): string | null {
  if (!iso) return null;
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayMs = Date.parse(`${todayIso}T00:00:00Z`);
  const targetMs = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(todayMs) || !Number.isFinite(targetMs)) return null;
  const days = Math.round((targetMs - todayMs) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days < 0) return `${-days}d overdue`;
  if (days <= 30) return `in ${days}d`;
  return formatDateShort(iso);
}

export default function CoordinatorClient() {
  const [board, setBoard] = useState<CoordinatorBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/dashboard/transactions/coordinator", {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          board?: CoordinatorBoard;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || data.ok === false || !data.board) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setBoard(data.board);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-72 animate-pulse rounded-2xl bg-slate-100"
            aria-hidden
          />
        ))}
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Couldn&apos;t load the coordinator board: {error ?? "unknown error"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <KpiStrip totals={board.totals} />

      {board.totals.transactionCount === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-600">
          <p className="text-base font-semibold text-slate-900">No active deals.</p>
          <p className="mt-1">
            New transactions appear here automatically once they&apos;re opened
            in <Link href="/dashboard/transactions" className="font-semibold text-slate-700 underline">Transactions</Link>.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {board.columns.map((column) => (
            <StageColumn key={column.stage} column={column} />
          ))}
        </div>
      )}
    </div>
  );
}

function KpiStrip({ totals }: { totals: CoordinatorBoard["totals"] }) {
  const cells = [
    {
      label: "In-flight deals",
      value: String(totals.transactionCount),
      tone: "text-slate-900",
    },
    {
      label: "Overdue tasks",
      value: String(totals.overdueTasksTotal),
      tone: totals.overdueTasksTotal > 0 ? "text-rose-700" : "text-slate-900",
    },
    {
      label: "Closing this week",
      value: String(totals.closingThisWeek),
      tone: totals.closingThisWeek > 0 ? "text-emerald-700" : "text-slate-900",
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
      {cells.map((c) => (
        <div key={c.label} className="bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {c.label}
          </p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${c.tone}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

function StageColumn({ column }: { column: CoordinatorStageColumn }) {
  return (
    <section className="flex min-h-[200px] flex-col rounded-2xl border border-slate-200 bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          {column.label}
        </h2>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-700">
          {column.cards.length}
        </span>
      </header>

      {column.cards.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-6 text-center text-[11px] text-slate-400">
          No open work at this stage.
        </div>
      ) : (
        <ul className="space-y-2 p-2">
          {column.cards.map((card) => (
            <li key={card.transaction.id}>
              <CardForStage stage={column.stage} card={card} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CardForStage({
  stage,
  card,
}: {
  stage: CoordinatorStageColumn["stage"];
  card: CoordinatorTransactionCard;
}) {
  const stageMetrics = card.byStage[stage];
  const txn = card.transaction;
  const isPastDue = stageMetrics.overdueCount > 0;
  const dueLabel = daysFromTodayLabel(stageMetrics.earliestDue);

  return (
    <Link
      href={`/dashboard/transactions/${encodeURIComponent(txn.id)}`}
      className={`block rounded-xl border bg-white px-3 py-2.5 shadow-sm transition hover:shadow ${
        isPastDue ? "border-rose-200" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-xs font-semibold text-slate-900">
          {txn.property_address}
        </p>
        {isPastDue ? (
          <span className="shrink-0 rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-rose-700">
            {stageMetrics.overdueCount} overdue
          </span>
        ) : null}
      </div>

      <p className="mt-1 truncate text-[11px] text-slate-500">
        {txn.contact_name ?? "—"}
        {txn.purchase_price ? ` · ${formatMoney(txn.purchase_price)}` : ""}
      </p>

      {stageMetrics.nextUpTitle ? (
        <p className="mt-2 line-clamp-2 text-[11px] text-slate-700">
          <span className="font-semibold">Next:</span> {stageMetrics.nextUpTitle}
        </p>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-500">
        <span>
          {stageMetrics.openCount} open
          {card.overall.totalTasks > 0
            ? ` · ${card.overall.completedTasks}/${card.overall.totalTasks} all-stage`
            : ""}
        </span>
        {dueLabel ? (
          <span
            className={`font-semibold ${isPastDue ? "text-rose-700" : "text-slate-700"}`}
          >
            {dueLabel}
          </span>
        ) : null}
      </div>

      {txn.closing_date ? (
        <p className="mt-1 text-[10px] text-slate-400">
          Closing {formatDateShort(txn.closing_date)}
        </p>
      ) : null}
    </Link>
  );
}
