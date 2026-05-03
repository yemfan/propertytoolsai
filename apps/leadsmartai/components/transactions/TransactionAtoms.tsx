/**
 * Reusable atoms for any surface that summarizes a transaction —
 * list-page rows, kanban cards, the detail header. The original D1
 * proposal called for a single `<TransactionSummary mode="...">` mega-
 * component but each surface has different layout needs (table cells,
 * flex card, h1 + breadcrumb), so a small set of atoms composes more
 * naturally than one configurable component.
 *
 * Use these atoms in any new surface that displays a transaction —
 * keeps the visual + label vocabulary consistent across the app.
 */

import type { TransactionStatus, TransactionType } from "@/lib/transactions/types";

// ── Type badge ─────────────────────────────────────────────────────

const TYPE_LABELS: Record<TransactionType, string> = {
  buyer_rep: "Buyer",
  listing_rep: "Listing",
  dual: "Dual",
};

const TYPE_STYLES: Record<TransactionType, string> = {
  buyer_rep: "bg-violet-50 text-violet-700 border-violet-200",
  listing_rep: "bg-orange-50 text-orange-700 border-orange-200",
  dual: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

export function TransactionTypeBadge({ type }: { type: TransactionType }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${TYPE_STYLES[type]}`}
    >
      {TYPE_LABELS[type]}
    </span>
  );
}

// ── Status pill ────────────────────────────────────────────────────

const STATUS_STYLES: Record<TransactionStatus, string> = {
  active: "bg-blue-50 text-blue-700 border-blue-200",
  closed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  terminated: "bg-red-50 text-red-700 border-red-200",
  pending: "bg-amber-50 text-amber-800 border-amber-200",
};

export function TransactionStatusPill({ status }: { status: TransactionStatus }) {
  const tone = STATUS_STYLES[status] ?? "bg-slate-50 text-slate-700 border-slate-200";
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${tone}`}
    >
      {status}
    </span>
  );
}

// ── Task counts badge ──────────────────────────────────────────────

export function TransactionTasksBadge({
  total,
  completed,
  overdue,
}: {
  total: number;
  completed: number;
  overdue: number;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-slate-600">
        {completed}/{total}
      </span>
      {overdue > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
          {overdue} overdue
        </span>
      ) : null}
    </div>
  );
}

// ── Closing-date label ─────────────────────────────────────────────

/**
 * Shared formatter for closing-date display. Returns a label like
 * "2026-05-28 · 12d" (future), "2026-04-15 · 3d past" (overdue), or
 * "—" (no date set). Pure helper — surfaces compose it however they
 * want (inline, in a table cell, etc).
 */
export function formatClosingLabel(iso: string | null): string {
  if (!iso) return "—";
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const target = new Date(`${iso}T00:00:00Z`);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (Number.isNaN(days)) return iso;
  return `${iso} · ${days >= 0 ? `${days}d` : `${-days}d past`}`;
}

export function TransactionClosingLabel({ iso }: { iso: string | null }) {
  return <span className="text-slate-700">{formatClosingLabel(iso)}</span>;
}
