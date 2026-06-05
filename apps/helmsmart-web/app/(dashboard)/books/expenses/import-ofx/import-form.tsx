"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle2, AlertCircle, X } from "lucide-react";

interface ParsedTransaction {
  date: string;
  amount: string;
  description: string;
  memo: string;
  type: "debit" | "credit";
  _valid: boolean;
  _error?: string;
}

// ─── OFX/QFX parser ──────────────────────────────────────────────────────────
// Parses text-based OFX format (SGML style, not true XML)

function parseOFX(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  // Extract all STMTTRN blocks (statement transactions)
  const stmtTrnPattern = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = stmtTrnPattern.exec(text)) !== null) {
    const block = match[1];

    // Extract individual fields using regex
    const trnTypeMatch = /<TRNTYPE>([A-Z]+)/i.exec(block);
    const dtPostedMatch = /<DTPOSTED>(\d{8})/i.exec(block);
    const trnAmtMatch = /<TRNAMT>(-?[\d.]+)/i.exec(block);
    const nameMatch = /<NAME>([^<]+)/i.exec(block);
    const memoMatch = /<MEMO>([^<]*)/i.exec(block);

    if (!dtPostedMatch || !trnAmtMatch) continue;

    const dateStr = dtPostedMatch[1];
    const amount = parseFloat(trnAmtMatch[1]);
    const type = trnTypeMatch?.[1]?.toUpperCase() ?? "DEBIT";
    const name = nameMatch?.[1]?.trim() ?? "";
    const memo = memoMatch?.[1]?.trim() ?? "";

    // Format date as YYYY-MM-DD from YYYYMMDD
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    const date = `${year}-${month}-${day}`;

    // Only import debits as expenses; skip credits (deposits, refunds, etc.)
    if (amount > 0 && type !== "DEBIT") continue;

    // Description: prefer NAME, fallback to MEMO
    const description = name || memo || "Bank transaction";

    // Validate
    const isValid = !isNaN(amount) && amount !== 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);

    transactions.push({
      date,
      amount: Math.abs(amount).toFixed(2),
      description: description.slice(0, 100),
      memo: memo.slice(0, 200),
      type: amount < 0 ? "debit" : "credit",
      _valid: isValid && amount < 0,
      _error: !isValid ? "Invalid date or amount" : undefined,
    });
  }

  return transactions;
}

// ─── Template / example download ──────────────────────────────────────────────

function showOFXExample() {
  const example = `OFXHEADER:100
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEFORMAT:NO
NEWFILEFORMAT:YES
DATA:OFSGML
VERSION:102

<OFX>
<SIGNONSIGNON>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20250630
<LANGUAGE>ENG
</SIGNON>
<BANKMSGSRSV1>
<STMTTRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<CURDEF>USD
<STMTRS>
<BANKACC_FROM>
<BANKID>123456789
<ACCTID>0987654321
<ACCTTYPE>CHECKING
</BANKACC_FROM>
<BANKTRANLIST>
<DTSTART>20250601
<DTEND>20250630
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20250601
<TRNAMT>-42.50
<FITID>1234567890
<NAME>STARBUCKS
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20250602
<TRNAMT>-85.00
<FITID>1234567891
<NAME>OFFICE DEPOT
<MEMO>Office supplies
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRS>
</BANKMSGSRSV1>
</OFX>`;

  alert("OFX format example:\n\n" + example.split("\n").slice(0, 10).join("\n") + "\n\n(Full example shown — export from your bank or Quicken)");
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ImportOFXForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows]         = useState<ParsedTransaction[]>([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult]     = useState<{ inserted: number; failed: number; skipped: number } | null>(null);
  const [error, setError]       = useState("");
  const [pending, start]        = useTransition();

  function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseOFX(text);
      if (parsed.length === 0) {
        setError("No transactions found in this OFX file. Ensure it contains STMTTRN blocks.");
      } else {
        setRows(parsed);
      }
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".ofx") || file.name.endsWith(".qfx") || file.type === "application/vnd.intu.qbo" || file.type === "text/plain")) {
      handleFile(file);
    } else {
      setError("Please upload an .ofx or .qfx file");
    }
  }

  function handleImport() {
    const valid = rows.filter((r) => r._valid);
    if (valid.length === 0) { setError("No valid transactions to import"); return; }
    setError("");
    start(async () => {
      try {
        const res = await fetch("/api/books/expenses/import-ofx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: valid }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Import failed");
        setResult({ inserted: data.inserted, failed: data.failed, skipped: data.skipped ?? 0 });
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
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 flex items-start gap-4">
        <div className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5 font-bold">ⓘ</div>
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-800 mb-1">OFX/QFX Format</p>
          <p className="text-xs text-blue-700 leading-relaxed">
            Upload a bank statement export from Quicken, QuickBooks, your bank's website, or any financial software that supports OFX format.
            Debits (expenses) will be imported as expense transactions; credits (deposits) are skipped.
          </p>
          <button
            onClick={showOFXExample}
            className="text-xs font-medium text-blue-600 underline mt-2 hover:text-blue-800"
          >
            View OFX format example
          </button>
        </div>
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
          accept=".ofx,.qfx"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
        {fileName ? (
          <p className="text-sm font-medium text-slate-700">{fileName}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-600">Drop your OFX/QFX file here, or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">Supports .ofx and .qfx file formats</p>
          </>
        )}
      </div>

      {/* Preview table */}
      {rows.length > 0 && !result && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-800">Transactions</h2>
              <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                {validCount} to import
              </span>
              {invalidCount > 0 && (
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                  {invalidCount} skipped
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
                  {["", "Date", "Amount", "Description", "Memo"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.slice(0, 50).map((row, i) => (
                  <tr key={i} className={row._valid ? "" : "bg-slate-50"}>
                    <td className="px-3 py-2">
                      {row._valid
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        : <span title={row._error}><AlertCircle className="w-3.5 h-3.5 text-slate-300" /></span>
                      }
                    </td>
                    <td className="px-3 py-2 text-slate-800 font-medium">{row.date}</td>
                    <td className="px-3 py-2 text-slate-800 font-medium">
                      ${parseFloat(row.amount).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-slate-600 truncate">{row.description}</td>
                    <td className="px-3 py-2 text-slate-500 text-[11px] max-w-[100px] truncate">{row.memo || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && (
              <p className="text-xs text-slate-400 text-center py-3">
                Showing first 50 of {rows.length} transactions
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
              Imported {result.inserted} transaction{result.inserted !== 1 ? "s" : ""}
              {result.skipped > 0 && ` · ${result.skipped} credits skipped`}
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
            {pending ? `Importing ${validCount} transactions…` : `Import ${validCount} transaction${validCount !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
