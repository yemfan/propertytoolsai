import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { BooksNav } from "@/components/books-nav";
import { EstimateBuilder } from "@/components/estimate-builder";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "New Estimate · Books" };

export default async function NewEstimatePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client: clientParam } = await searchParams;
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value ?? "";
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, first_name, last_name, company, email")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  return (
    <div className="p-8 max-w-4xl mx-auto">
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
          Back to estimates
        </Link>
      </div>

      <BooksNav />

      <h2 className="text-base font-semibold text-slate-800 mb-4">
        New Estimate
      </h2>

      <EstimateBuilder
        clients={
          (clients ?? []) as {
            id: string;
            first_name: string | null;
            last_name: string | null;
            company: string | null;
            email: string | null;
          }[]
        }
        preselectedClientId={clientParam}
      />
    </div>
  );
}
