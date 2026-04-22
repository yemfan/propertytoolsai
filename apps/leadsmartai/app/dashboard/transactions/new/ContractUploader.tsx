"use client";

import { useRef, useState } from "react";

export type ContractUploadResult = {
  propertyAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  purchasePrice: number | null;
  mutualAcceptanceDate: string | null;
  closingDate: string | null;
  buyerNames: string[];
  sellerNames: string[];
  contingencies: {
    inspectionDays: number | null;
    appraisalDays: number | null;
    loanDays: number | null;
  };
  confidence: number;
  warnings: string[];
};

type Props = {
  onExtracted: (result: ContractUploadResult) => void;
  disabled?: boolean;
};

/**
 * Drag-and-drop / click-to-upload zone that POSTs a PDF to the extract
 * endpoint. Returns parsed fields to the parent form for pre-population.
 *
 * Intentionally visual-only on the happy path — errors render inline, but
 * everything else is "picked a file, see a spinner, see fields fill in".
 * We don't show the raw JSON; the form becomes the source of truth.
 */
export function ContractUploader({ onExtracted, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justExtracted, setJustExtracted] = useState<{
    filename: string;
    confidence: number;
    warnings: string[];
  } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/dashboard/transactions/extract-contract", {
        method: "POST",
        body: form,
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        extraction?: ContractUploadResult;
        error?: string;
      };
      if (!res.ok || !body.ok || !body.extraction) {
        setError(body.error ?? "Extraction failed.");
        return;
      }
      onExtracted(body.extraction);
      setJustExtracted({
        filename: file.name,
        confidence: body.extraction.confidence,
        warnings: body.extraction.warnings,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-700">
        Ratified contract PDF <span className="font-normal text-slate-400">(optional)</span>
      </label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !loading) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (disabled || loading) return;
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        onClick={() => {
          if (!disabled && !loading) inputRef.current?.click();
        }}
        className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border-2 border-dashed px-4 py-3 text-sm transition-colors ${
          dragActive
            ? "border-slate-700 bg-slate-50"
            : loading
              ? "border-slate-300 bg-slate-50"
              : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <div className="min-w-0">
          {loading ? (
            <div className="text-slate-700">
              <div className="font-medium">Reading contract…</div>
              <div className="text-[11px] text-slate-500">15-40 seconds for most PDFs.</div>
            </div>
          ) : justExtracted ? (
            <div className="text-slate-700">
              <div className="font-medium text-green-700">
                ✓ Filled from {justExtracted.filename}
              </div>
              <div className="text-[11px] text-slate-500">
                Confidence {Math.round(justExtracted.confidence * 100)}%. Review the fields below
                and adjust anything the extractor got wrong.
              </div>
            </div>
          ) : (
            <div className="text-slate-700">
              <div className="font-medium">Drop a CAR RPA here, or click to pick</div>
              <div className="text-[11px] text-slate-500">
                We read the PDF with Claude and pre-fill the form. Nothing is stored — the PDF
                is dropped as soon as the fields come back.
              </div>
            </div>
          )}
        </div>
        <div className="shrink-0 text-2xl" aria-hidden>
          {loading ? "⏳" : justExtracted ? "✅" : "📄"}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        disabled={disabled || loading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          // Reset so the same file can be re-selected if needed.
          e.target.value = "";
        }}
        className="hidden"
      />

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      {justExtracted?.warnings.length ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <div className="font-medium">Extractor warnings:</div>
          <ul className="mt-1 list-disc pl-5">
            {justExtracted.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
