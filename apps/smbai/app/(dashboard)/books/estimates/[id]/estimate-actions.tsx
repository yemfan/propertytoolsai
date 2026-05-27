"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Send, CheckCircle2, XCircle, FileText, Loader2,
} from "lucide-react";
import {
  sendEstimate,
  setEstimateStatus,
  convertEstimateToInvoice,
} from "@/lib/actions/estimates";

interface Props {
  estimateId: string;
  status: string;
  hasClientEmail: boolean;
  convertedInvoiceId: string | null;
}

export function EstimateActions({
  estimateId,
  status,
  hasClientEmail,
  convertedInvoiceId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(action: string, fn: () => Promise<void | string>) {
    setActiveAction(action);
    setError(null);
    startTransition(async () => {
      try {
        const result = await fn();
        if (typeof result === "string") {
          // Result is the new invoice ID — navigate to it
          router.push(`/books/invoices/${result}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setActiveAction(null);
      }
    });
  }

  const loading = isPending;

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Send */}
      {(status === "draft" || status === "sent") && (
        <button
          onClick={() =>
            run("send", async () => {
              await sendEstimate(estimateId);
            })
          }
          disabled={loading || !hasClientEmail}
          title={!hasClientEmail ? "Client has no email address" : undefined}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading && activeAction === "send" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {status === "sent" ? "Resend estimate" : "Send estimate"}
        </button>
      )}

      {/* Accept */}
      {(status === "sent" || status === "draft") && (
        <button
          onClick={() =>
            run("accept", async () => {
              await setEstimateStatus(estimateId, "accepted");
            })
          }
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {loading && activeAction === "accept" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          Mark accepted
        </button>
      )}

      {/* Decline */}
      {(status === "sent" || status === "draft") && (
        <button
          onClick={() =>
            run("decline", async () => {
              await setEstimateStatus(estimateId, "declined");
            })
          }
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {loading && activeAction === "decline" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <XCircle className="w-3.5 h-3.5" />
          )}
          Mark declined
        </button>
      )}

      {/* Convert to invoice */}
      {status === "accepted" && !convertedInvoiceId && (
        <button
          onClick={() => run("convert", () => convertEstimateToInvoice(estimateId))}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading && activeAction === "convert" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          Convert to invoice
        </button>
      )}
    </div>
  );
}
