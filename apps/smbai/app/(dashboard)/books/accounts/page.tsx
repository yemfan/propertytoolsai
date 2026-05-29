import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { BooksNav } from "@/components/books-nav";

export const metadata: Metadata = { title: "Accounts · Books" };

const TYPE_ORDER = ["asset", "liability", "equity", "revenue", "expense"] as const;
const TYPE_LABELS: Record<string, string> = {
  asset:     "Assets",
  liability: "Liabilities",
  equity:    "Equity",
  revenue:   "Revenue",
  expense:   "Expenses",
};
const TYPE_COLORS: Record<string, string> = {
  asset:     "bg-blue-50 text-blue-700",
  liability: "bg-rose-50 text-rose-700",
  equity:    "bg-purple-50 text-purple-700",
  revenue:   "bg-emerald-50 text-emerald-700",
  expense:   "bg-amber-50 text-amber-700",
};

export default async function AccountsPage() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value ?? "";
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from("chart_of_accounts")
    .select("id, code, name, type, normal_balance, tax_line_code, is_active, description")
    .eq("organization_id", orgId)
    .order("code");

  // Group by type
  const grouped = new Map<string, typeof accounts>();
  for (const acct of accounts ?? []) {
    const arr = grouped.get(acct.type) ?? [];
    arr.push(acct);
    grouped.set(acct.type, arr);
  }

  const total = accounts?.length ?? 0;
  const active = accounts?.filter((a) => a.is_active).length ?? 0;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Books</h1>
          <p className="text-sm text-slate-500 mt-0.5">AI-powered bookkeeping — cash basis, double-entry</p>
        </div>
        <p className="text-xs text-slate-400">{active} of {total} accounts active</p>
      </div>

      <BooksNav />

      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-700">Chart of Accounts</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Auto-generated based on your entity type.{" "}
          <span className="text-amber-600 font-medium">
            ⚠ Tax line codes require CPA review before use.
          </span>
        </p>
      </div>

      <div className="space-y-6">
        {TYPE_ORDER.map((type) => {
          const typeAccounts = grouped.get(type);
          if (!typeAccounts?.length) return null;

          return (
            <div key={type} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Section header */}
              <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100">
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${TYPE_COLORS[type]}`}>
                  {TYPE_LABELS[type]}
                </span>
                <span className="text-xs text-slate-400">{typeAccounts.length} accounts</span>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[80px_1fr_100px_80px] gap-4 px-5 py-2 border-b border-slate-50 text-xs font-medium text-slate-400 uppercase tracking-wide">
                <span>Code</span>
                <span>Name</span>
                <span>Normal balance</span>
                <span className="text-right">Tax code</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-slate-50">
                {typeAccounts.map((acct) => (
                  <div
                    key={acct.id}
                    className={`grid grid-cols-[80px_1fr_100px_80px] gap-4 px-5 py-2.5 items-center ${
                      acct.is_active ? "" : "opacity-40"
                    }`}
                  >
                    <span className="text-xs font-mono text-slate-500">{acct.code}</span>
                    <span className="text-sm text-slate-800">{acct.name}</span>
                    <span className="text-xs text-slate-500 capitalize">{acct.normal_balance}</span>
                    <span className="text-xs text-right">
                      {acct.tax_line_code ? (
                        <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
                          {acct.tax_line_code}
                        </code>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {!total && (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-sm text-slate-400">
          No accounts found. Complete onboarding to seed your chart of accounts.
        </div>
      )}
    </div>
  );
}
