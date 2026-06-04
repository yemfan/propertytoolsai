"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { approveApproval, rejectApproval } from "@/lib/actions/approvals";

type Status = "idle" | "approving" | "rejecting" | "approved" | "rejected" | "error";

export function ApprovalActions({
  approvalId,
  editableContent,
}: {
  approvalId: string;
  /** When provided, show an editable textarea so the owner can tweak the
   *  message before approving. Only meaningful for text-based tools (SMS). */
  editableContent?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [body, setBody] = useState(editableContent ?? "");
  const [errorMsg, setErrorMsg] = useState("");
  const [, startTransition] = useTransition();

  function onApprove() {
    setStatus("approving");
    startTransition(async () => {
      const res = await approveApproval(approvalId, editableContent !== undefined ? body : undefined);
      if (res.ok) {
        setStatus("approved");
      } else {
        setErrorMsg(res.error ?? "Something went wrong.");
        setStatus("error");
      }
    });
  }

  function onReject() {
    setStatus("rejecting");
    startTransition(async () => {
      const res = await rejectApproval(approvalId);
      setStatus(res.ok ? "rejected" : "error");
    });
  }

  if (status === "approved") {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg">
        <Check className="w-3.5 h-3.5" /> Approved — sending now
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
        <X className="w-3.5 h-3.5" /> Rejected
      </div>
    );
  }

  if (status === "error") {
    return (
      <p className="text-xs text-rose-600">{errorMsg || "Something went wrong. Please try again."}</p>
    );
  }

  const busy = status === "approving" || status === "rejecting";

  return (
    <div className="space-y-3">
      {/* Editable body — only for text-based tools (SMS) */}
      {editableContent !== undefined && (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={busy}
          rows={3}
          maxLength={320}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none disabled:opacity-50"
          placeholder="Edit message before approving…"
        />
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={onApprove}
          disabled={busy || (editableContent !== undefined && !body.trim())}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          {status === "approving" ? "Sending…" : "Approve & send"}
        </button>
        <button
          onClick={onReject}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          {status === "rejecting" ? "Rejecting…" : "Reject"}
        </button>
      </div>
    </div>
  );
}
