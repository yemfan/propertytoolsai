import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { Users, Mail, Phone, Building2, Download, Upload } from "lucide-react";
import { AddClientModal } from "@/components/add-client-modal";

export const metadata: Metadata = { title: "Clients" };

const STATUS_COLORS: Record<string, string> = {
  lead:     "bg-slate-100 text-slate-600",
  prospect: "bg-blue-100 text-blue-700",
  active:   "bg-emerald-100 text-emerald-700",
  inactive: "bg-amber-100 text-amber-700",
  archived: "bg-red-100 text-red-700",
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const statusFilter = params.status ?? "";

  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value ?? "";
  const supabase = await createClient();

  let dbQuery = supabase
    .from("clients")
    .select("id, first_name, last_name, company, email, phone, status, tags, lifetime_value, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (statusFilter) dbQuery = dbQuery.eq("status", statusFilter);
  if (query) {
    dbQuery = dbQuery.or(
      `first_name.ilike.%${query}%,last_name.ilike.%${query}%,company.ilike.%${query}%,email.ilike.%${query}%`
    );
  }

  const { data: clients } = await dbQuery.limit(100);

  // Status counts
  const { data: allStatuses } = await supabase
    .from("clients")
    .select("status")
    .eq("organization_id", orgId);

  const counts = (allStatuses ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {counts.active ?? 0} active · {counts.lead ?? 0} leads · {counts.prospect ?? 0} prospects
          </p>
        </div>
        <Link
          href="/clients/import"
          className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Import
        </Link>
        <Link
          href="/api/export/clients"
          className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export
        </Link>
        <AddClientModal />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <form method="GET" className="flex-1 min-w-[200px] max-w-sm">
          <input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search clients…"
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
        </form>

        <div className="flex gap-1">
          {(["", "lead", "prospect", "active", "inactive"] as const).map((s) => (
            <a
              key={s}
              href={s ? `/clients?status=${s}${query ? `&q=${query}` : ""}` : `/clients${query ? `?q=${query}` : ""}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                statusFilter === s
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s || "All"}
            </a>
          ))}
        </div>
      </div>

      {/* Client list */}
      {!clients?.length ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-3">
            <Users className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">
            {query || statusFilter ? "No clients match your filters" : "No clients yet"}
          </p>
          <p className="text-xs text-slate-400 max-w-xs">
            {query || statusFilter
              ? "Try broadening your search or filter."
              : "Add your first client to start tracking leads, contacts, and revenue."}
          </p>
          {!query && !statusFilter && (
            <div className="mt-5">
              <AddClientModal />
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-[1fr_160px_120px_100px] gap-4 px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wide">
            <span>Name</span>
            <span>Contact</span>
            <span>Status</span>
            <span className="text-right">Lifetime</span>
          </div>

          <div className="divide-y divide-slate-100">
            {clients.map((client) => {
              const fullName = [client.first_name, client.last_name].filter(Boolean).join(" ");
              return (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="grid grid-cols-[1fr_160px_120px_100px] gap-4 px-5 py-3.5 items-center hover:bg-slate-50 transition-colors"
                >
                  {/* Name / company / tags */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{fullName}</p>
                    {client.company && (
                      <p className="text-xs text-slate-400 truncate flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3" />
                        {client.company}
                      </p>
                    )}
                    {client.tags?.length ? (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {(client.tags as string[]).map((tag) => (
                          <span key={tag} className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-600 font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {/* Contact */}
                  <div className="min-w-0 space-y-0.5">
                    {client.email && (
                      <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        {client.email}
                      </p>
                    )}
                    {client.phone && (
                      <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        {client.phone}
                      </p>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[client.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {client.status}
                    </span>
                  </div>

                  {/* Lifetime value */}
                  <div className="text-right">
                    <span className="text-sm font-medium text-slate-700 tabular-nums">
                      {(client.lifetime_value ?? 0) > 0
                        ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(client.lifetime_value)
                        : "—"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
