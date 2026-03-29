import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DashboardTableColumn<T> = {
  key: keyof T | string;
  header: string;
  className?: string;
  cell?: (row: T) => ReactNode;
};

export type DashboardTableProps<T extends Record<string, unknown>> = {
  columns: DashboardTableColumn<T>[];
  rows: T[];
  emptyLabel?: string;
  className?: string;
};

export function DashboardTable<T extends Record<string, unknown>>({
  columns,
  rows,
  emptyLabel = "No rows to display.",
  className,
}: DashboardTableProps<T>) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-slate-100", className)}>
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {columns.map((c) => (
              <th key={String(c.key)} className={cn("px-4 py-3 pr-6", c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/80">
                {columns.map((c) => (
                  <td key={String(c.key)} className={cn("px-4 py-3 align-middle text-slate-800", c.className)}>
                    {c.cell ? c.cell(row) : String(row[c.key as keyof T] ?? "—")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
