import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import Expenses" };

export default function ImportExpensesPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Import Expenses</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Upload a CSV to add multiple expenses at once — import from spreadsheets, bank exports, or accounting software
          </p>
        </div>
        <Link
          href="/books/expenses"
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Expenses
        </Link>
      </div>

      <ImportForm />
    </div>
  );
}
