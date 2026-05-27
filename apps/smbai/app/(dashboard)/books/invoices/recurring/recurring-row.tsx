"use client";

import { useTransition } from "react";
import { Pause, Play, Trash2 } from "lucide-react";
import {
  setRecurringStatus,
  deleteRecurringInvoice,
} from "@/lib/actions/recurring";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface RecurringInvoice {
  id: string;
  client_id: string | null;
  frequency: string;
  next_invoice_date: string;
  last_generated_at: string | null;
  status: "active" | "paused";
  title: string;
  tax_rate: number;
  line_items: LineItem[];
  // joined
  clients:
    | { first_name: string | null; last_name: string | null; company: string | null }
    | Array<{ first_name: string | null; last_name: string | null; company: string | null }>
    | null;
}

interface Props {
  recurring: RecurringInvoice;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FREQ_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};

function calcTotal(items: LineItem[], taxRate: number): number {
  const subtotal = items.reduce(
    (s, i) => s + Number(i.quantity) * Number(i.unit_price),
    0
  );
  return subtotal * (1 + Number(taxRate));
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RecurringRow({ recurring }: Props) {
  const [isPending, startTransition] = useTransition();

  // Resolve client name
  const clientRaw = recurring.clients;
  const client = Array.isArray(clientRaw) ? clientRaw[0] : clientRaw;
  const clientName = client
    ? [client.first_name, client.last_name].filter(Boolean).join(" ") ||
      client.company ||
      "—"
    : "No client";

  const total = calcTotal(
    (recurring.line_items as LineItem[]) ?? [],
    recurring.tax_rate
  );

  const isActive = recurring.status === "active";

  function handleToggle() {
    startTransition(() => {
      setRecurringStatus(recurring.id, isActive ? "paused" : "active");
    });
  }

  function handleDelete() {
    if (
      !window.confirm(
        "Delete this recurring invoice? Future invoices will not be generated. This cannot be undone."
      )
    )
      return;
    startTransition(() => {
      deleteRecurringInvoice(recurring.id);
    });
  }

  return (
    <div
      className={`grid grid-cols-[1fr_120px_100px_120px_100px] gap-4 px-6 py-4 items-center transition-colors ${
        isPending ? "opacity-50" : "hover:bg-slate-50"
      }`}
    >
      {/* Client / title */}
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{clientName}</p>
        {recurring.title && (
          <p className="text-xs text-slate-400 truncate mt-0.5">{recurring.title}</p>
        )}
      </div>

      {/* Frequency */}
      <div>
        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
          {FREQ_LABELS[recurring.frequency] ?? recurring.frequency}
        </span>
      </div>

      {/* Amount */}
      <div>
        <span className="text-sm font-semibold text-slate-800 tabular-nums">
          {fmt(total)}
        </span>
      </div>

      {/* Next invoice */}
      <div>
        <span className={`text-sm ${isActive ? "text-slate-700" : "text-slate-400"}`}>
          {fmtDate(recurring.next_invoice_date)}
        </span>
        {recurring.last_generated_at && (
          <p className="text-[10px] text-slate-400 mt-0.5">
            Last: {fmtDate(recurring.last_generated_at.slice(0, 10))}
          </p>
        )}
      </div>

      {/* Status + actions */}
      <div className="flex items-center justify-end gap-1.5">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
            isActive
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          {isActive ? "Active" : "Paused"}
        </span>

        <button
          onClick={handleToggle}
          disabled={isPending}
          title={isActive ? "Pause" : "Resume"}
          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40"
        >
          {isActive ? (
            <Pause className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
        </button>

        <button
          onClick={handleDelete}
          disabled={isPending}
          title="Delete"
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
