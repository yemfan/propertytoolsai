import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText, Plus } from "lucide-react";
import { BooksNav } from "@/components/books-nav";
import { listEstimateTemplates } from "@/lib/actions/estimate-templates";
import { DeleteTemplateButton } from "./delete-template-button";

export const metadata: Metadata = { title: "Estimate Templates · Books" };

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default async function EstimateTemplatesPage() {
  const templates = await listEstimateTemplates();

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

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-800">Estimate Templates</h2>
        <Link
          href="/books/estimates/new"
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          <Plus className="w-3.5 h-3.5" />
          New estimate
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">No templates yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Build an estimate and click &ldquo;Save as template&rdquo; to reuse its line items.
          </p>
          <Link
            href="/books/estimates/new"
            className="mt-4 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            Create an estimate →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-50">
          {templates.map((t) => {
            const subtotal = t.lines.reduce((s, l) => s + Number(l.amount), 0);
            return (
              <div key={t.id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{t.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t.lines.length} line{t.lines.length === 1 ? "" : "s"} · {fmt(subtotal)} subtotal
                    {t.tax_rate > 0 ? ` · ${(t.tax_rate * 100).toFixed(2)}% tax` : ""}
                  </p>
                </div>
                <DeleteTemplateButton id={t.id} name={t.name} />
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-400 mt-4">
        Templates appear in the &ldquo;Start from template&rdquo; picker when creating a new estimate.
      </p>
    </div>
  );
}
