import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import Clients" };

export default function ImportClientsPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Import Clients</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Upload a CSV to add multiple clients at once
          </p>
        </div>
        <Link
          href="/clients"
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Clients
        </Link>
      </div>

      <ImportForm />
    </div>
  );
}
