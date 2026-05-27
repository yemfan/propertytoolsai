"use client";

import { useActionState, useState } from "react";
import { CheckCircle, SkipForward, ChevronDown } from "lucide-react";
import { approveTransaction, skipTransaction } from "@/lib/actions/transactions";
import type { ApproveState } from "@/lib/actions/transactions";

type CoaOption = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type Transaction = {
  id: string;
  date: string;
  name: string;
  merchant_name: string | null;
  amount: number;
  pending: boolean;
  personal_finance_category: string | null;
  reviewed: boolean;
  memo: string | null;
  ai_category_confidence: number | null;
  ai_suggested_memo: string | null;
  journal_entry_id: string | null;
  coa_account_id: string | null;
  bank_accounts: { name: string; mask: string | null; type: string } | { name: string; mask: string | null; type: string }[];
};

interface Props {
  transaction: Transaction;
  coa: CoaOption[];
}

export function TransactionReviewRow({ transaction: t, coa }: Props) {
  const [state, action, isPending] = useActionState<ApproveState, FormData>(
    approveTransaction,
    null
  );
  const [skipping, setSkipping] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isPosted = !!t.journal_entry_id;
  const isMoneyOut = t.amount > 0;
  const absAmount = Math.abs(t.amount);

  const displayAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(absAmount);

  const merchant = t.merchant_name ?? t.name;
  const aiAccount = coa.find((a) => a.id === t.coa_account_id);
  const aiConfidence = t.ai_category_confidence;
  const confidenceLabel =
    aiConfidence !== null
      ? aiConfidence >= 0.9
        ? "High"
        : aiConfidence >= 0.7
        ? "Medium"
        : "Low"
      : null;

  const confidenceColor =
    aiConfidence !== null
      ? aiConfidence >= 0.9
        ? "text-emerald-600"
        : aiConfidence >= 0.7
        ? "text-amber-600"
        : "text-rose-600"
      : "text-slate-400";

  // Filter CoA to relevant accounts based on transaction direction
  const relevantCoa = coa.filter((a) =>
    isMoneyOut
      ? ["expense", "liability"].includes(a.type)
      : ["revenue", "asset"].includes(a.type)
  );

  const handleSkip = async () => {
    setSkipping(true);
    await skipTransaction(t.id);
    setSkipping(false);
  };

  if (t.reviewed && !expanded) {
    return (
      <div
        className="grid grid-cols-[90px_1fr_160px_100px_90px] gap-4 px-4 py-3 items-center opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
        onClick={() => setExpanded(true)}
      >
        <span className="text-xs text-slate-400 tabular-nums">
          {new Date(t.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
        <div className="min-w-0">
          <p className="text-sm text-slate-600 truncate">{merchant}</p>
          {t.memo && <p className="text-xs text-slate-400 truncate">{t.memo}</p>}
        </div>
        <span className="text-xs text-slate-500 truncate">
          {aiAccount ? `${aiAccount.code} · ${aiAccount.name}` : t.memo === "[Skipped]" ? "Skipped" : "—"}
        </span>
        <span className={`text-sm font-medium text-right tabular-nums ${isMoneyOut ? "text-rose-500" : "text-emerald-600"}`}>
          {isMoneyOut ? "-" : "+"}{displayAmount}
        </span>
        <span className="text-right">
          {isPosted ? (
            <span className="text-xs text-emerald-600 font-medium">Posted</span>
          ) : (
            <span className="text-xs text-slate-400">Reviewed</span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className={`px-4 py-3 ${expanded ? "bg-indigo-50/40" : ""}`}>
      {/* Main row */}
      <div className="grid grid-cols-[90px_1fr_160px_100px_90px] gap-4 items-start">
        {/* Date */}
        <span className="text-xs text-slate-400 tabular-nums pt-0.5">
          {new Date(t.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>

        {/* Description */}
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{merchant}</p>
          {t.personal_finance_category && (
            <p className="text-xs text-slate-400 truncate mt-0.5">
              {t.personal_finance_category.replace(/_/g, " ").toLowerCase()}
            </p>
          )}
          {t.ai_suggested_memo && (
            <p className="text-xs text-indigo-500 truncate mt-0.5 italic">
              AI: {t.ai_suggested_memo}
            </p>
          )}
        </div>

        {/* AI category suggestion */}
        <div>
          {aiAccount ? (
            <div>
              <p className="text-xs text-slate-700 truncate font-medium">{aiAccount.name}</p>
              {confidenceLabel && (
                <p className={`text-[10px] font-medium ${confidenceColor}`}>
                  {confidenceLabel} confidence
                </p>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-400">Not categorized</span>
          )}
        </div>

        {/* Amount */}
        <span className={`text-sm font-medium text-right tabular-nums pt-0.5 ${isMoneyOut ? "text-rose-600" : "text-emerald-600"}`}>
          {isMoneyOut ? "-" : "+"}{displayAmount}
        </span>

        {/* Actions */}
        {!t.reviewed ? (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              title="Expand"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          </div>
        ) : (
          <span className="text-right">
            {isPosted ? (
              <span className="text-xs text-emerald-600 font-medium">Posted</span>
            ) : (
              <button
                onClick={() => setExpanded((e) => !e)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Edit
              </button>
            )}
          </span>
        )}
      </div>

      {/* Expanded approve form */}
      {expanded && (
        <div className="mt-3 pl-[118px]">
          <form action={action} className="flex items-end gap-3 flex-wrap">
            <input type="hidden" name="transaction_id" value={t.id} />

            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Category
              </label>
              <select
                name="coa_account_id"
                defaultValue={t.coa_account_id ?? ""}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Select account —</option>
                {relevantCoa.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Memo (optional)
              </label>
              <input
                type="text"
                name="memo"
                defaultValue={t.ai_suggested_memo ?? t.memo ?? ""}
                placeholder="Brief note…"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium
                           hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                {isPending ? "Saving…" : "Approve"}
              </button>

              <button
                type="button"
                onClick={handleSkip}
                disabled={skipping || isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium
                           hover:bg-slate-50 disabled:opacity-60 transition-colors"
              >
                <SkipForward className="w-3.5 h-3.5" />
                Skip
              </button>
            </div>
          </form>

          {state?.error && (
            <p className="mt-2 text-xs text-red-600">{state.error}</p>
          )}
          {state?.success && (
            <p className="mt-2 text-xs text-emerald-600">Approved and posted to journal.</p>
          )}
        </div>
      )}
    </div>
  );
}
