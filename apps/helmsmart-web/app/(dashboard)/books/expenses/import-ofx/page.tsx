import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ImportOFXForm } from "./import-form";

export const metadata: Metadata = { title: "Import OFX/QFX Statement" };

export default function ImportOFXPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Import Bank Statement</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Upload an OFX or QFX file from your bank, Quicken, or QuickBooks to import transactions
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

      <ImportOFXForm />
    </div>
  );
}
