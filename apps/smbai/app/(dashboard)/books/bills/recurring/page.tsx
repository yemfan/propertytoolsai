import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { BooksNav } from "@/components/books-nav";
import { listRecurringBills } from "@/lib/actions/recurring-bills";
import { listVendorNames } from "@/lib/actions/vendors";
import { RecurringBillsClient } from "./recurring-bills-client";

export const metadata: Metadata = { title: "Recurring Bills · Books" };

export default async function RecurringBillsPage() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value ?? "";
  const supabase = await createClient();

  const [recurring, expenseAccountsRes, vendorNames] = await Promise.all([
    listRecurringBills(),
    supabase
      .from("chart_of_accounts")
      .select("id, code, name")
      .eq("organization_id", orgId)
      .eq("type", "expense")
      .eq("is_active", true)
      .order("code"),
    listVendorNames(),
  ]);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Books</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          AI-powered bookkeeping — cash basis, double-entry
        </p>
      </div>

      <BooksNav />

      <RecurringBillsClient
        initialRecurring={recurring}
        expenseAccounts={(expenseAccountsRes.data ?? []) as { id: string; code: string; name: string }[]}
        vendorNames={vendorNames}
      />
    </div>
  );
}
