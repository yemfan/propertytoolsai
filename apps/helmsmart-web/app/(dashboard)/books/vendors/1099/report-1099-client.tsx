"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, FileText } from "lucide-react";
import type { Report1099 } from "@/lib/actions/vendors";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function Report1099Client({ report, years }: { report: Report1099; years: number[] }) {
  const router = useRouter();

  function exportCsv() {
    const rows: string[] = [
      `Contractor,Email,Paid ${report.year},Reportable (>= $600)`,
      ...report.rows.map(
        (r) => `"${r.name}","${r.email ?? ""}",${r.paidThisYear.toFixed(2)},${r.meetsThreshold ? "Yes" : "No"}`
      ),
      `Total,,${report.totalPaid.toFixed(2)},`,
    ];
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `1099_${report.year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-slate-800">1099 contractor report</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {report.reportableCount} contractor{report.reportableCount === 1 ? "" : "s"} at or over $600 · {fmt(report.totalPaid)} paid in {report.year}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/books/vendors"
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Vendors
          </Link>
          <select
            value={report.year}
            onChange={(e) => router.push(`/books/vendors/1099?year=${e.target.value}`)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {report.rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl">
          <FileText className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500 mb-1">No 1099 contractors yet</p>
          <p className="text-xs text-slate-400 mb-4 max-w-sm">
            Mark a vendor as a &ldquo;1099 contractor&rdquo; in the Vendors directory and their paid totals will roll up here for year-end filing.
          </p>
          <Link href="/books/vendors" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
            Go to Vendors →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Paid in {report.year}</h3>
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
          <div className="grid grid-cols-[1.8fr_1fr_120px] gap-3 px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wide">
            <span>Contractor</span>
            <span className="text-right">Paid</span>
            <span className="text-right">Status</span>
          </div>
          <div className="divide-y divide-slate-50">
            {report.rows.map((r) => (
              <div key={r.id} className="grid grid-cols-[1.8fr_1fr_120px] gap-3 px-5 py-3 items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{r.name}</p>
                  {r.email && <p className="text-xs text-slate-400 truncate">{r.email}</p>}
                </div>
                <span className="text-sm font-medium text-slate-800 text-right tabular-nums">{fmt(r.paidThisYear)}</span>
                <span className="text-right">
                  {r.meetsThreshold ? (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">1099-NEC</span>
                  ) : (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">Under $600</span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[1.8fr_1fr_120px] gap-3 px-5 py-3 bg-slate-50 border-t border-slate-100 items-center">
            <span className="text-sm font-semibold text-slate-700">Total</span>
            <span className="text-sm font-bold text-slate-800 text-right tabular-nums">{fmt(report.totalPaid)}</span>
            <span />
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-4">
        Cash-basis: totals are bills marked paid during {report.year}, matched to each flagged contractor by name. Contractors paid $600 or more generally require a 1099-NEC. Confirm with your accountant.
      </p>
    </div>
  );
}
