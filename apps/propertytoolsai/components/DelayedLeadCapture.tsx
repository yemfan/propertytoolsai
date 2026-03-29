"use client";

import { useEffect, useState } from "react";
import LocalSeoLeadForm from "@/components/LocalSeoLeadForm";

export default function DelayedLeadCapture({
  delayMs = 8000,
  title,
  source,
  city,
}: {
  delayMs?: number;
  title: string;
  source: string;
  city?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOpen(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-[min(94vw,520px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Before you leave:</p>
          <p className="text-xs text-slate-600">Get your free estimate and follow-up strategy.</p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
        >
          Close
        </button>
      </div>
      <LocalSeoLeadForm title={title} source={source} city={city} />
    </div>
  );
}

