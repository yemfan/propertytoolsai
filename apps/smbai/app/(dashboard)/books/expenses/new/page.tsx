import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { BooksNav } from "@/components/books-nav";
import { ExpenseForm } from "@/components/expense-form";

export const metadata: Metadata = { title: "New Expense · Books" };

export default async function NewExpensePage() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value ?? "";
  const supabase = await createClient();

  const [{ data: expenseAccounts }, { data: bankAccounts }, { data: projects }] = await Promise.all([
    supabase
      .from("chart_of_accounts")
      .select("id, code, name")
      .eq("organization_id", orgId)
      .eq("type", "expense")
      .eq("is_active", true)
      .order("code"),
    supabase
      .from("bank_accounts")
      .select("id, name, mask")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("projects")
      .select("id, name")
      .eq("organization_id", orgId)
      .in("status", ["active", "paused"])
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <BooksNav />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Record Expense</h1>
          <p className="text-sm text-slate-500 mt-0.5">Post a manual expense to the journal</p>
        </div>
        <Link
          href="/books/expenses"
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Expenses
        </Link>
      </div>

      <ExpenseForm
        expenseAccounts={expenseAccounts ?? []}
        bankAccounts={bankAccounts ?? []}
        projects={projects ?? []}
      />
    </div>
  );
}
