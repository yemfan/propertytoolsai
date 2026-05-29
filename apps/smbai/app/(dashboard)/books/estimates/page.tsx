import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { BooksNav } from "@/components/books-nav";
import { Plus, FileSignature, CheckCircle2, Send, XCircle, Clock } from "lucide-react";

export const metadata: Metadata = { title: "Estimates · Books" };

const STATUS_CONFIG = {
  draft:    { label: "Draft",    color: "bg-slate-100 text-slate-600",     icon: FileSignature },
  sent:     { label: "Sent",     color: "bg-blue-100 text-blue-700",       icon: Send },
  accepted: { label: "Accepted", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  declined: { label: "Declined", color: "bg-rose-100 text-rose-700",       icon: XCircle },
  expired:  { label: "Expired",  color: "bg-amber-100 text-amber-700",     icon: Clock },
} as const;

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default async function EstimatesPage() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value ?? "";
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);

  const { data: estimates } = await supabase
    .from("estimates")
    .select(`
      id, estimate_number, status, issue_date, expiry_date, total,
      clients(first_name, last_name, company)
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  // Summary stats
  const all = estimates ?? [];
  const pending = all.filter((e) => e.status === "sent");
  const accepted = all.filter((e) => e.status === "accepted");
  const totalPending = pending.reduce((s, e) => s + Number(e.total), 0);
  const totalAccepted = accepted.reduce((s, e) => s + Number(e.total), 0);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Books</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            AI-powered bookkeeping — cash basis, double-entry
          </p>
        </div>
        <Link
          href="/books/estimates/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New estimate
        </Link>
      </div>

      <BooksNav />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          {
            label: "Pending",
            value: fmt(totalPending),
            sub: `${pending.length} sent`,
            color: "text-blue-700",
          },
          {
            label: "Accepted",
            value: fmt(totalAccepted),
            sub: `${accepted.length} estimates`,
            color: "text-emerald-700",
          },
          {
            label: "Total sent",
            value: String(all.filter((e) => e.status !== "draft").length),
            sub: `${all.length} total estimates`,
            color: "text-slate-800",
          },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              {label}
            </p>
            <p className={`text-2xl font-semibold font-mono ${color}`}>{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Estimates list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {!all.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-3">
              <FileSignature className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600 mb-1">No estimates yet</p>
            <p className="text-xs text-slate-400 max-w-xs mb-5">
              Create and send professional estimates to clients. Accepted estimates convert to invoices in one click.
            </p>
            <Link
              href="/books/estimates/new"
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" /> Create estimate
            </Link>
          </div>
        ) : (
          <>
            {/* Header row */}
            <div className="grid grid-cols-[1fr_120px_100px_100px_140px] gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <span>Client / Number</span>
              <span>Issued</span>
              <span>Expires</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Status</span>
            </div>

            <div className="divide-y divide-slate-50">
              {all.map((est) => {
                const clientRaw = est.clients;
                const client = (
                  Array.isArray(clientRaw) ? clientRaw[0] : clientRaw
                ) as {
                  first_name: string | null;
                  last_name: string | null;
                  company: string | null;
                } | null;
                const clientName = client
                  ? [client.first_name, client.last_name]
                      .filter(Boolean)
                      .join(" ") ||
                    client.company ||
                    "—"
                  : "—";

                // Auto-expire if sent + past expiry
                const effectiveStatus =
                  est.status === "sent" && est.expiry_date < today
                    ? "expired"
                    : (est.status as keyof typeof STATUS_CONFIG);

                const cfg =
                  STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.draft;
                const StatusIcon = cfg.icon;

                return (
                  <Link
                    key={est.id}
                    href={`/books/estimates/${est.id}`}
                    className="grid grid-cols-[1fr_120px_100px_100px_140px] gap-4 px-6 py-4 hover:bg-slate-50 transition-colors items-center"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {clientName}
                      </p>
                      <p className="text-xs text-slate-400 font-mono">
                        {est.estimate_number}
                      </p>
                    </div>
                    <span className="text-sm text-slate-600">
                      {new Date(
                        est.issue_date + "T00:00:00"
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span
                      className={`text-sm ${
                        effectiveStatus === "expired"
                          ? "text-amber-600 font-medium"
                          : "text-slate-600"
                      }`}
                    >
                      {new Date(
                        est.expiry_date + "T00:00:00"
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="text-sm font-semibold text-slate-800 tabular-nums text-right">
                      {fmt(Number(est.total))}
                    </span>
                    <div className="flex justify-end">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
