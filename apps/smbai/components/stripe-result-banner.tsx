"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

interface Props {
  result: "success" | "cancelled";
}

export function StripeResultBanner({ result }: Props) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  const isSuccess = result === "success";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-6 text-sm ${
        isSuccess
          ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
          : "bg-amber-50 border border-amber-200 text-amber-800"
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
      )}
      <span className="flex-1">
        {isSuccess
          ? "Payment completed successfully — the invoice will be marked paid shortly."
          : "Payment was cancelled. The invoice has not been charged."}
      </span>
      <button
        onClick={() => setVisible(false)}
        className="p-0.5 rounded hover:bg-black/5 transition-colors flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
