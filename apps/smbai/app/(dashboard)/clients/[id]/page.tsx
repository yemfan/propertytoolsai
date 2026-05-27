import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  ArrowLeft, Mail, Phone, Building2, Calendar,
  FileText, MessageSquare, Tag, DollarSign, Receipt,
} from "lucide-react";
import { ClientEditForm } from "./client-edit-form";
import { PortalLinkButton } from "./portal-link-button";

export const metadata: Metadata = { title: "Client · CRM" };

const STATUS_COLORS: Record<string, string> = {
  lead:     "bg-slate-100 text-slate-600",
  prospect: "bg-blue-100 text-blue-700",
  active:   "bg-emerald-100 text-emerald-700",
  inactive: "bg-amber-100 text-amber-700",
  archived: "bg-red-100 text-red-700",
};

const INV_STATUS_COLORS: Record<string, string> = {
  draft:   "bg-slate-100 text-slate-500",
  sent:    "bg-blue-100 text-blue-700",
  paid:    "bg-emerald-100 text-emerald-700",
  overdue: "bg-rose-100 text-rose-700",
  void:    "bg-slate-100 text-slate-400",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value ?? "";
  const supabase = await createClient();

  const [clientRes, invoicesRes, messagesRes] = await Promise.all([
    supabase
      .from("clients")
      .select("*, portal_token")
      .eq("id", id)
      .eq("organization_id", orgId)
      .single(),
    supabase
      .from("invoices")
      .select("id, invoice_number, status, issue_date, due_date, total, paid_at")
      .eq("client_id", id)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("messages")
      .select("id, channel, direction, subject, body, sent_at, read")
      .eq("client_id", id)
      .eq("organization_id", orgId)
      .order("sent_at", { ascending: false })
      .limit(10),
  ]);

  if (!clientRes.data) notFound();
  const client = clientRes.data;
  const invoices = invoicesRes.data ?? [];
  const messages = messagesRes.data ?? [];

  const today = new Date().toISOString().slice(0, 10);
  const fullName = [client.first_name, client.last_name].filter(Boolean).join(" ");
  const displayName = fullName || client.company || "Client";

  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.total), 0);

  const outstanding = invoices.filter((i) => i.status === "sent" || i.status === "overdue");
  const totalOutstanding = outstanding.reduce((s, i) => s + Number(i.total), 0);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 mb-8">
        <Link
          href="/clients"
          className="mt-1 p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-900">{displayName}</h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[client.status] ?? STATUS_COLORS.lead}`}>
              {client.status}
            </span>
          </div>
          {client.company && fullName && (
            <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" />
              {client.company}
            </p>
          )}
        </div>
        {/* Quick actions */}
        <div className="flex gap-2">
          {client.email && (
            <Link
              href={`/inbox?compose=${encodeURIComponent(client.email)}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
            >
              <Mail className="w-3.5 h-3.5" /> Send email
            </Link>
          )}
          {client.portal_token && (
            <PortalLinkButton portalToken={client.portal_token} />
          )}
          <Link
            href={`/books/expenses/new`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <Receipt className="w-3.5 h-3.5" /> Add expense
          </Link>
          <Link
            href={`/books/invoices/new?client=${id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <FileText className="w-3.5 h-3.5" /> New invoice
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Lifetime value", value: fmt(totalPaid), icon: DollarSign, color: "text-emerald-500" },
              { label: "Outstanding",    value: fmt(totalOutstanding), icon: FileText,  color: "text-blue-500" },
              { label: "Invoices",       value: String(invoices.length), icon: FileText, color: "text-slate-400" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{label}</span>
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
                <p className="text-lg font-semibold text-slate-800 tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          {/* Invoices */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Invoices</h2>
              <Link
                href={`/books/invoices/new?client=${id}`}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                + New
              </Link>
            </div>

            {invoices.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">No invoices yet</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {invoices.map((inv) => {
                  const effectiveStatus =
                    inv.status === "sent" && inv.due_date < today ? "overdue" : inv.status;
                  return (
                    <Link
                      key={inv.id}
                      href={`/books/invoices/${inv.id}`}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <span className="font-mono text-xs text-slate-500 w-24 flex-shrink-0">{inv.invoice_number}</span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${INV_STATUS_COLORS[effectiveStatus] ?? ""}`}>
                        {effectiveStatus}
                      </span>
                      <span className="flex-1 text-xs text-slate-400">
                        {new Date(inv.issue_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <span className="text-sm font-semibold text-slate-700 tabular-nums flex-shrink-0">
                        {fmt(Number(inv.total))}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Messages</h2>
              <Link href="/inbox" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                Open inbox →
              </Link>
            </div>

            {messages.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">No messages yet</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {messages.map((msg) => (
                  <div key={msg.id} className="flex items-start gap-3 px-5 py-3">
                    <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                      msg.channel === "email" ? "bg-blue-50" : "bg-emerald-50"
                    }`}>
                      {msg.channel === "email"
                        ? <Mail className="w-3 h-3 text-blue-500" />
                        : <MessageSquare className="w-3 h-3 text-emerald-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      {msg.subject && (
                        <p className="text-xs font-medium text-slate-700 truncate">{msg.subject}</p>
                      )}
                      <p className="text-xs text-slate-500 truncate">{msg.body}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-[10px] text-slate-400">{timeAgo(msg.sent_at)}</p>
                      <p className={`text-[10px] capitalize ${msg.direction === "inbound" ? "text-indigo-500" : "text-slate-400"}`}>
                        {msg.direction}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column — edit form */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Details</h2>
            </div>
            <div className="p-5">
              <ClientEditForm
                clientId={client.id}
                initialValues={{
                  first_name: client.first_name ?? "",
                  last_name: client.last_name ?? "",
                  company: client.company ?? "",
                  email: client.email ?? "",
                  phone: client.phone ?? "",
                  status: client.status,
                  source: client.source ?? "",
                  notes: client.notes ?? "",
                  tags: (client.tags as string[] | null)?.join(", ") ?? "",
                }}
              />
            </div>
          </div>

          {/* Meta */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Created {new Date(client.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
            </div>
            {client.source && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <span>Source: {client.source}</span>
              </div>
            )}
            {(client.tags as string[] | null)?.length ? (
              <div className="flex flex-wrap gap-1 mt-2">
                {(client.tags as string[]).map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded text-[11px] bg-indigo-50 text-indigo-600 font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
