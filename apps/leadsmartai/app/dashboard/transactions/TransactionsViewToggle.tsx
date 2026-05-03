import Link from "next/link";

/**
 * Shared View toggle for the Transactions section. List and Board are
 * the same data — flat table at /dashboard/transactions, stage-grouped
 * kanban at /dashboard/transactions/coordinator. Mirrors the
 * Month / List toggle on /dashboard/calendar so the gesture is
 * consistent across the app.
 */
export function TransactionsViewToggle({ current }: { current: "list" | "board" }) {
  return (
    <div className="inline-flex shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white text-xs font-medium">
      <Link
        href="/dashboard/transactions"
        className={`px-3 py-1 transition ${
          current === "list" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
        }`}
        aria-current={current === "list" ? "page" : undefined}
      >
        List
      </Link>
      <Link
        href="/dashboard/transactions/coordinator"
        className={`px-3 py-1 transition ${
          current === "board" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
        }`}
        aria-current={current === "board" ? "page" : undefined}
      >
        Board
      </Link>
    </div>
  );
}
