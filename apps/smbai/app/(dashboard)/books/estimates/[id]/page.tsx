import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { BooksNav } from "@/components/books-nav";
import { EstimateActions } from "./estimate-actions";
import {
  ArrowLeft, Building2, Mail, FileSignature,
  CheckCircle2, Send, XCircle, Clock, FileText,
} from "lucide-react";

export const metadata: Metadata = { title: "Estimate · Books" };

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

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value ?? "";
  const supabase = await createClient();

  const { data: est } = await supabase
    .from("estimates")
    .select(`
      *,
      clients(id, first_name, last_name, company, email),
      estimate_lines(id, description, quantity, unit_price, amount, sort_order),
      organizations(name)
    `)
    .eq("id", id)
    .eq("organization_id", orgId)
    .single();

  if (!est) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const effectiveStatus =
    est.status === "sent" && est.expiry_date < today
      ? "expired"
      : (est.status as keyof typeof STATUS_CONFIG);

  const cfg = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.draft;
  const StatusIcon = cfg.icon;

  const clientRaw = est.clients;
  const client = (Array.isArray(clientRaw) ? clientRaw[0] : clientRaw) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
    email: string | null;
  } | null;

  const clientName = client
    ? [client.first_name, client.last_name].filter(Boolean).join(" ") ||
      client.company ||
      "Unknown client"
    : "No client";

  const lines = (
    Array.isArray(est.estimate_lines) ? est.estimate_lines : []
  ) as {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
    sort_order: number;
  }[];

  const sortedLines = [...lines].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  const orgRaw = est.organizations;
  const org = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as {
    name: string;
  } | null;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Books</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            AI-powered bookkeeping — cash basis, double-entry
          </p>
        </div>
        <Link
          href="/books/estimates"
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Estimates
        </Link>
      </div>

      <BooksNav />

      {/* Estimate body */}
      <div className="grid grid-cols-[1fr_280px] gap-6">
        {/* Left: estimate document */}
        <div className="space-y-6">
          {/* Estimate card */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Header bar */}
            <div className="bg-slate-900 px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white font-semibold text-lg">
                    {est.estimate_number}
                  </p>
                  <p className="text-slate-400 text-sm mt-0.5">
                    {org?.name ?? "Estimate"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white text-2xl font-bold font-mono">
                    {fmt(Number(est.total))}
                  </p>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full mt-1 ${cfg.color}`}
                  >
                    <StatusIcon className="w-3 h-3" />
                    {cfg.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Dates row */}
            <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
              <div className="px-6 py-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">
                  Issue date
                </p>
                <p className="text-sm text-slate-800">{fmtDate(est.issue_date)}</p>
              </div>
              <div className="px-6 py-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">
                  Valid until
                </p>
                <p
                  className={`text-sm ${
                    effectiveStatus === "expired"
                      ? "text-amber-600 font-medium"
                      : "text-slate-800"
                  }`}
                >
                  {fmtDate(est.expiry_date)}
                </p>
              </div>
            </div>

            {/* Client */}
            {client && (
              <div className="px-6 py-4 border-b border-slate-100">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  Client
                </p>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <Link
                    href={`/clients/${client.id}`}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    {clientName}
                  </Link>
                </div>
                {client.email && (
                  <div className="flex items-center gap-2 mt-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500">{client.email}</span>
                  </div>
                )}
              </div>
            )}

            {/* Line items */}
            <div className="px-6 py-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Description
                    </th>
                    <th className="text-center pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-16">
                      Qty
                    </th>
                    <th className="text-right pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">
                      Price
                    </th>
                    <th className="text-right pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLines.map((line) => (
                    <tr key={line.id} className="border-b border-slate-50">
                      <td className="py-3 text-slate-700">{line.description}</td>
                      <td className="py-3 text-center text-slate-500">
                        {Number(line.quantity)}
                      </td>
                      <td className="py-3 text-right text-slate-500">
                        {fmt(Number(line.unit_price))}
                      </td>
                      <td className="py-3 text-right font-medium text-slate-800">
                        {fmt(Number(line.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end mt-4">
                <div className="w-56 space-y-1.5 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{fmt(Number(est.subtotal))}</span>
                  </div>
                  {Number(est.tax_rate) > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>
                        Tax ({(Number(est.tax_rate) * 100).toFixed(0)}%)
                      </span>
                      <span className="tabular-nums">
                        {fmt(Number(est.tax_amount))}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-slate-900 border-t border-slate-200 pt-2">
                    <span>Total</span>
                    <span className="tabular-nums font-mono">
                      {fmt(Number(est.total))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {est.notes && (
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                    Notes
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                    {est.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Converted invoice link */}
          {est.converted_invoice_id && (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <div className="flex-1 text-sm text-emerald-800">
                Converted to an invoice
              </div>
              <Link
                href={`/books/invoices/${est.converted_invoice_id}`}
                className="text-sm font-medium text-emerald-700 hover:text-emerald-900 transition-colors"
              >
                View invoice →
              </Link>
            </div>
          )}
        </div>

        {/* Right: actions panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Actions
            </h3>
            <EstimateActions
              estimateId={est.id}
              status={effectiveStatus}
              hasClientEmail={!!client?.email}
              convertedInvoiceId={est.converted_invoice_id}
            />
          </div>

          {/* Estimate info */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Details
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Number</dt>
                <dd className="font-mono text-slate-800">{est.estimate_number}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}
                  >
                    <StatusIcon className="w-3 h-3" />
                    {cfg.label}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Issued</dt>
                <dd className="text-slate-800">
                  {new Date(est.issue_date + "T00:00:00").toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric", year: "numeric" }
                  )}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Expires</dt>
                <dd className="text-slate-800">
                  {new Date(est.expiry_date + "T00:00:00").toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric", year: "numeric" }
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
