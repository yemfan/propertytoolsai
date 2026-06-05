"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { respondToApprovalStep } from "@/lib/actions/approval-chains";

export function ApprovalActionButtons({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showReject, setShowReject] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      const result = await respondToApprovalStep(requestId, "approved", note || undefined);
      if (!result.ok) {
        setError(result.error ?? "Failed to approve");
      } else {
        router.refresh();
      }
    });
  };

  const handleReject = () => {
    if (!showReject) {
      setShowReject(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await respondToApprovalStep(requestId, "rejected", note || undefined);
      if (!result.ok) {
        setError(result.error ?? "Failed to reject");
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
      <h2 className="text-sm font-semibold text-slate-800 mb-4">Your Decision</h2>

      {showReject && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Reason for rejection (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Explain why this is being rejected..."
            rows={3}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
          />
        </div>
      )}

      {!showReject && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Note (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add an optional comment with your approval..."
            rows={2}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleApprove}
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <CheckCircle2 className="w-4 h-4" />
          {isPending ? "Saving…" : "Approve"}
        </button>
        <button
          onClick={handleReject}
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <XCircle className="w-4 h-4" />
          {showReject ? "Confirm Rejection" : "Reject"}
        </button>
        {showReject && (
          <button
            onClick={() => { setShowReject(false); setNote(""); }}
            className="px-4 py-2.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
