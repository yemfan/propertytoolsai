import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { BooksNav } from "@/components/books-nav";
import { BookOpen } from "lucide-react";

export const metadata: Metadata = { title: "Journal · Books" };

const SOURCE_LABELS: Record<string, string> = {
  bank_import:     "Bank import",
  invoice:         "Invoice",
  expense:         "Expense",
  adjustment:      "Adjustment",
  opening_balance: "Opening balance",
  period_close:    "Period close",
  reversal:        "Reversal",
};

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const pageSize = 40;

  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value ?? "";
  const supabase = await createClient();

  const { data: entries, count } = await supabase
    .from("journal_entries")
    .select("id, date, memo, source_type, is_reversal, created_at", { count: "exact" })
    .eq("organization_id", orgId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  // Fetch lines for these entries to compute totals
  const entryIds = (entries ?? []).map((e) => e.id);
  const { data: lines } = entryIds.length
    ? await supabase
        .from("journal_lines")
        .select("journal_entry_id, debit, credit, account_id, description, chart_of_accounts!inner(code, name)")
        .in("journal_entry_id", entryIds)
    : { data: [] };

  // Group lines by entry id
  const linesByEntry = new Map<string, typeof lines>();
  for (const line of lines ?? []) {
    const arr = linesByEntry.get(line.journal_entry_id) ?? [];
    arr.push(line);
    linesByEntry.set(line.journal_entry_id, arr);
  }

  const totalPages = Math.ceil((count ?? 0) / pageSize);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Books</h1>
          <p className="text-sm text-slate-500 mt-0.5">AI-powered bookkeeping — cash basis, double-entry</p>
        </div>
      </div>

      <BooksNav />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700">General Ledger</h2>
        <span className="text-xs text-slate-400">{count ?? 0} entries</span>
      </div>

      {!entries?.length ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-3">
            <BookOpen className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">No journal entries yet</p>
          <p className="text-xs text-slate-400 max-w-xs">
            Approve transactions in the Transactions tab to post double-entry journal entries here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const entryLines = linesByEntry.get(entry.id) ?? [];
            const totalDebit = entryLines.reduce((s, l) => s + Number(l.debit ?? 0), 0);

            return (
              <div key={entry.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Entry header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-400 tabular-nums w-20">
                      {new Date(entry.date + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-sm font-medium text-slate-700 truncate max-w-xs">
                      {entry.memo ?? "—"}
                    </span>
                    {entry.is_reversal && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        Reversal
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">
                      {SOURCE_LABELS[entry.source_type] ?? entry.source_type}
                    </span>
                    <span className="text-sm font-semibold text-slate-700 tabular-nums">
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(totalDebit)}
                    </span>
                  </div>
                </div>

                {/* Lines */}
                <div className="divide-y divide-slate-50">
                  {entryLines.map((line, i) => {
                    const acctRaw = line.chart_of_accounts;
                    const acct = (Array.isArray(acctRaw) ? acctRaw[0] : acctRaw) as { code: string; name: string } | null | undefined;
                    const isDebit = Number(line.debit) > 0;
                    const amount = isDebit ? Number(line.debit) : Number(line.credit);

                    return (
                      <div
                        key={i}
                        className={`grid grid-cols-[1fr_100px_100px] gap-4 px-5 py-2.5 text-sm ${isDebit ? "" : "pl-16"}`}
                      >
                        <span className="text-slate-600 truncate">
                          {acct ? `${acct.code} · ${acct.name}` : "—"}
                          {line.description && (
                            <span className="text-slate-400 ml-2 text-xs">{line.description}</span>
                          )}
                        </span>
                        <span className="text-right tabular-nums text-slate-800">
                          {isDebit
                            ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
                            : ""}
                        </span>
                        <span className="text-right tabular-nums text-slate-500">
                          {!isDebit
                            ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
                            : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {page > 1 && (
            <a href={`/books/journal?page=${page - 1}`}
               className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600">
              ← Previous
            </a>
          )}
          <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <a href={`/books/journal?page=${page + 1}`}
               className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600">
              Next →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
