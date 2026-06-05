"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X } from "lucide-react";

interface ParsedRow {
  date: string;
  amount: string;
  description: string;
  category: string;
  _valid: boolean;
  _error?: string;
}

// ─── CSV parser (no external deps) ───────────────────────────────────────────

function parseCsv(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
        if (ch === "\r") i++;
        row.push(cell); cell = "";
        if (row.some((c) => c !== "")) lines.push(row);
        row = [];
      } else cell += ch;
    }
  }
  if (cell || row.length) { row.push(cell); if (row.some((c) => c !== "")) lines.push(row); }
  return lines;
}

function parseRows(text: string): ParsedRow[] {
  const lines = parseCsv(text);
  if (lines.length < 2) return [];

  // Normalise header names
  const headers = lines[0].map((h) => h.toLowerCase().trim().replace(/\s+/g, "_"));

  const col = (row: string[], name: string) => {
    const idx = headers.indexOf(name);
    return idx >= 0 ? (row[idx] ?? "").trim() : "";
  };

  return lines.slice(1).map((row) => {
    const date = col(row, "date");
    const amount = col(row, "amount");
    const description = col(row, "description") || col(row, "vendor_name") || col(row, "vendor");
    const category = col(row, "category") || "";

    const valid = !!(date && amount && description && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0);
    return {
      date,
      amount,
      description,
      category,
      _valid: valid,
      _error: valid ? undefined :
        !date ? "date is required (YYYY-MM-DD)" :
        !amount ? "amount is required" :
        isNaN(parseFloat(amount)) ? "amount must be a number" :
        parseFloat(amount) <= 0 ? "amount must be positive" :
        "description is required",
    };
  });
}

// ─── Template download ────────────────────────────────────────────────────────

function downloadTemplate() {
  const csv = `date,amount,description,category
2025-06-01,85.50,Office supplies at Staples,Office Supplies
2025-06-02,42.00,Lunch meeting with client,Meals & Entertainment
2025-06-03,120.00,Software subscription renewal,Dues & Subscriptions
`;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "expense_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ImportForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows]         = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult]     = useState<{ inserted: number; failed: number } | null>(null);
  const [error, setError]       = useState("");
  const [pending, start]        = useTransition();

  function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRows(parseRows(text));
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) handleFile(file);
    else setError("Please upload a .csv file");
  }

  function handleImport() {
    const valid = rows.filter((r) => r._valid);
    if (valid.length === 0) { setError("No valid rows to import"); return; }
    setError("");
    start(async () => {
      try {
        const res = await fetch("/api/books/expenses/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: valid }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Import failed");
        setResult({ inserted: data.inserted, failed: data.failed });
        if (data.inserted > 0) {
          setTimeout(() => router.push("/books/expenses"), 1500);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed");
      }
    });
  }

  const validCount   = rows.filter((r) => r._valid).length;
  const invalidCount = rows.filter((r) => !r._valid).length;

  return (
    <div className="space-y-6">
      {/* Instructions + template */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 flex items-start gap-4">
        <FileSpreadsheet className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-indigo-800 mb-1">CSV format</p>
          <p className="text-xs text-indigo-700 leading-relaxed">
            Required: <code className="bg-indigo-100 px-1 rounded">date</code> (YYYY-MM-DD), <code className="bg-indigo-100 px-1 rounded">amount</code>, <code className="bg-indigo-100 px-1 rounded">description</code>.
            Optional: <code className="bg-indigo-100 px-1 rounded">category</code> (e.g., "Meals & Entertainment" — auto-matched to your Chart of Accounts).
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="text-xs font-medium text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap"
        >
          Download template
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors"
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
        {fileName ? (
          <p className="text-sm font-medium text-slate-700">{fileName}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-600">Drop your CSV here, or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">CSV files only · Supports exports from Quicken, QuickBooks, and bank statements</p>
          </>
        )}
      </div>

      {/* Preview table */}
      {rows.length > 0 && !result && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-800">Preview</h2>
              <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                {validCount} valid
              </span>
              {invalidCount > 0 && (
                <span className="text-xs text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full font-medium">
                  {invalidCount} will skip
                </span>
              )}
            </div>
            <button onClick={() => { setRows([]); setFileName(""); }} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {["", "Date", "Amount", "Description", "Category"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.slice(0, 50).map((row, i) => (
                  <tr key={i} className={row._valid ? "" : "bg-rose-50/40"}>
                    <td className="px-3 py-2">
                      {row._valid
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        : <span title={row._error}><AlertCircle className="w-3.5 h-3.5 text-rose-500" /></span>
                      }
                    </td>
                    <td className="px-3 py-2 text-slate-800 font-medium">{row.date || <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-2 text-slate-800 font-medium">
                      ${parseFloat(row.amount || "0").toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{row.description || <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-2 text-slate-600">{row.category || <span className="text-slate-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && (
              <p className="text-xs text-slate-400 text-center py-3">
                Showing first 50 of {rows.length} rows
              </p>
            )}
          </div>
        </div>
      )}

      {/* Result banner */}
      {result && (
        <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${result.failed === 0 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
          <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${result.failed === 0 ? "text-emerald-500" : "text-amber-500"}`} />
          <div>
            <p className={`text-sm font-semibold ${result.failed === 0 ? "text-emerald-800" : "text-amber-800"}`}>
              Imported {result.inserted} expense{result.inserted !== 1 ? "s" : ""}
              {result.failed > 0 && ` · ${result.failed} failed`}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Redirecting to Expenses…</p>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-4 py-3">{error}</p>
      )}

      {/* Actions */}
      {rows.length > 0 && !result && (
        <div className="flex gap-3">
          <button
            onClick={() => { setRows([]); setFileName(""); setError(""); }}
            disabled={pending}
            className="flex-1 py-3 text-sm font-medium border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleImport}
            disabled={pending || validCount === 0}
            className="flex-1 py-3 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {pending ? `Importing ${validCount} expenses…` : `Import ${validCount} expense${validCount !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
