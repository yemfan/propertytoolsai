import type { Metadata } from "next";
import { BooksNav } from "@/components/books-nav";
import { get1099Report } from "@/lib/actions/vendors";
import { Report1099Client } from "./report-1099-client";

export const metadata: Metadata = { title: "1099 Report · Books" };

export default async function Vendor1099Page({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = Number(yearParam) || currentYear;
  const report = await get1099Report(year);
  const years = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Books</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          AI-powered bookkeeping — cash basis, double-entry
        </p>
      </div>

      <BooksNav />

      <Report1099Client report={report} years={years} />
    </div>
  );
}
