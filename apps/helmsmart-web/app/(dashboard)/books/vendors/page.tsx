import { PageTitle } from "@/components/page-title";
import type { Metadata } from "next";
import { BooksNav } from "@/components/books-nav";
import { listVendorsWithSpend } from "@/lib/actions/vendors";
import { VendorsClient } from "./vendors-client";

export const metadata: Metadata = { title: "Vendors · Books" };

export default async function VendorsPage() {
  const vendors = await listVendorsWithSpend();

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <PageTitle base="Books" />
        <p className="text-sm text-slate-500 mt-0.5">
          AI-powered bookkeeping — cash basis, double-entry
        </p>
      </div>

      <BooksNav />

      <VendorsClient initialVendors={vendors} />
    </div>
  );
}
