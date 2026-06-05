import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { BooksNav } from "@/components/books-nav";
import { ArrowUpRight, AlertTriangle, Clock } from "lucide-react";

export const metadata: Metadata = { title: "Aging Reports · Books" };

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

type AgingBucket = "current" | "1-30" | "31-60" | "61-90" | "90+";

interface AgingRow {
  id: string;
  label: string; // invoice # or bill #, or vendor/client name
  dueDate: string;
  amount: number;
  bucket: AgingBucket;
  daysOverdue: number;
  href: string;
}

function getBucket(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "1-30";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";
  return "90+";
}

const BUCKET_ORDER: AgingBucket[] = ["current", "1-30", "31-60", "61-90", "90+"];

const BUCKET_COLORS: Record<AgingBucket, string> = {
  "current": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "1-30":    "bg-amber-50  text-amber-700  border-amber-200",
  "31-60":   "bg-orange-50 text-orange-700 border-orange-200",
  "61-90":   "bg-rose-50   text-rose-700   border-rose-200",
  "90+":     "bg-rose-100  text-rose-800   border-rose-300",
};

const BUCKET_LABELS: Record<AgingBucket, string> = {
  "current": "Current",
  "1-30":    "1–30 days",
  "31-60":   "31–60 days",
  "61-90":   "61–90 days",
  "90+":     "90+ days",
};

function AgingTable({
  title,
  rows,
  type,
}: {
  title: string;
  rows: AgingRow[];
  type: "ar" | "ap";
}) {
  const totals: Record<AgingBucket, number> = {
    "current": 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0,
  };
  for (const r of rows) totals[r.bucket] += r.amount;
  const grandTotal = rows.reduce((s, r) => s + r.amount, 0);
  const pastDue = rows.filter((r) => r.bucket !== "current").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {rows.length} open · {fmt(grandTotal)} total ·{" "}
            {pastDue > 0 ? (
              <span className="text-rose-600 font-medium">{fmt(pastDue)} past due</span>
            ) : (
              <span className="text-emerald-600 font-medium">nothing past due</span>
            )}
          </p>
        </div>
        <Link
          href={type === "ar" ? "/books/invoices" : "/books/bills"}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
        >
          View all <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Bucket summary bar */}
      <div className="grid grid-cols-5 gap-0 border-b border-slate-100">
        {BUCKET_ORDER.map((bucket) => (
          <div key={bucket} className={`p-4 text-center ${totals[bucket] > 0 ? "" : "opacity-40"}`}>
            <p className={`text-xs font-semibold px-2 py-0.5 rounded-full border inline-block ${BUCKET_COLORS[bucket]}`}>
              {BUCKET_LABELS[bucket]}
            </p>
            <p className="text-sm font-bold text-slate-800 mt-2 tabular-nums">
              {fmt(totals[bucket])}
            </p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-slate-400">No open {type === "ar" ? "invoices" : "bills"}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {type === "ar" ? "Client" : "Vendor"}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Reference
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Due Date
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Amount
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows
                .sort((a, b) => b.daysOverdue - a.daysOverdue)
                .map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3">
                      <Link
                        href={row.href}
                        className="font-medium text-slate-800 hover:text-indigo-600 transition-colors"
                      >
                        {row.label}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      —
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {new Date(row.dueDate + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">
                      {fmt(row.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full border ${BUCKET_COLORS[row.bucket]}`}
                      >
                        {row.bucket === "current"
                          ? "Current"
                          : `${row.daysOverdue}d overdue`}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function AgingPage() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value ?? "";
  const supabase = await createClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const [invoicesRes, billsRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, due_date, total, client:client_id(first_name, last_name, company)")
      .eq("organization_id", orgId)
      .in("status", ["sent", "overdue"])
      .order("due_date"),
    supabase
      .from("bills")
      .select("id, bill_number, vendor, due_date, amount")
      .eq("organization_id", orgId)
      .eq("status", "open")
      .order("due_date"),
  ]);

  // Build AR rows
  const arRows: AgingRow[] = (invoicesRes.data ?? []).map((inv) => {
    const due = new Date(inv.due_date + "T00:00:00");
    const daysOverdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86_400_000));
    const clientRaw = inv.client as unknown as { first_name?: string; last_name?: string; company?: string } | null;
    const clientName = clientRaw
      ? [clientRaw.first_name, clientRaw.last_name].filter(Boolean).join(" ") || clientRaw.company || "Client"
      : "Client";
    return {
      id: inv.id,
      label: clientName,
      dueDate: inv.due_date,
      amount: Number(inv.total),
      bucket: getBucket(daysOverdue),
      daysOverdue,
      href: `/books/invoices/${inv.id}`,
    };
  });

  // Build AP rows
  const apRows: AgingRow[] = (billsRes.data ?? []).map((bill) => {
    const due = new Date(bill.due_date + "T00:00:00");
    const daysOverdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86_400_000));
    return {
      id: bill.id,
      label: bill.vendor,
      dueDate: bill.due_date,
      amount: Number(bill.amount),
      bucket: getBucket(daysOverdue),
      daysOverdue,
      href: `/books/bills`,
    };
  });

  const totalAR = arRows.reduce((s, r) => s + r.amount, 0);
  const totalAP = apRows.reduce((s, r) => s + r.amount, 0);
  const overdueAR = arRows.filter((r) => r.bucket !== "current").reduce((s, r) => s + r.amount, 0);
  const overdueAP = apRows.filter((r) => r.bucket !== "current").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Aging Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Accounts receivable and payable — as of {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      <BooksNav />

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Total Receivable",
            value: fmt(totalAR),
            sub: `${arRows.length} open invoices`,
            color: "text-indigo-600",
          },
          {
            label: "AR Overdue",
            value: fmt(overdueAR),
            sub: `${arRows.filter((r) => r.bucket !== "current").length} invoices`,
            color: overdueAR > 0 ? "text-rose-600" : "text-emerald-600",
            warn: overdueAR > 0,
          },
          {
            label: "Total Payable",
            value: fmt(totalAP),
            sub: `${apRows.length} open bills`,
            color: "text-slate-700",
          },
          {
            label: "AP Overdue",
            value: fmt(overdueAP),
            sub: `${apRows.filter((r) => r.bucket !== "current").length} bills`,
            color: overdueAP > 0 ? "text-rose-600" : "text-emerald-600",
            warn: overdueAP > 0,
          },
        ].map(({ label, value, sub, color, warn }) => (
          <div
            key={label}
            className={`rounded-xl border p-5 ${warn ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200"}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
              {warn && <AlertTriangle className="w-4 h-4 text-rose-400" />}
            </div>
            <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <AgingTable title="Accounts Receivable (AR)" rows={arRows} type="ar" />
        <AgingTable title="Accounts Payable (AP)" rows={apRows} type="ap" />
      </div>
    </div>
  );
}
