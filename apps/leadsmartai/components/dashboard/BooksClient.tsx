"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Receipt, ChevronDown, ChevronUp } from "lucide-react";
import { formatMoney, computeTotals } from "@/lib/books/money";
import type { InvoiceRow, InvoiceStatus } from "@/lib/books/invoices";

type LineDraft = { description: string; quantity: string; unitPrice: string };

const STATUS_TONE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  sent: "bg-blue-50 text-blue-700 ring-blue-200",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  overdue: "bg-amber-50 text-amber-700 ring-amber-200",
  void: "bg-rose-50 text-rose-700 ring-rose-200",
};

const emptyLine = (): LineDraft => ({ description: "", quantity: "1", unitPrice: "" });

export default function BooksClient({ initialInvoices }: { initialInvoices: InvoiceRow[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(initialInvoices.length === 0);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Create-form state
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taxPct, setTaxPct] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(
    () =>
      computeTotals(
        lines.map((l) => ({ quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0 })),
        (Number(taxPct) || 0) / 100,
      ),
    [lines, taxPct],
  );

  const outstanding = useMemo(
    () =>
      initialInvoices
        .filter((i) => i.status === "sent" || i.status === "overdue")
        .reduce((s, i) => s + Number(i.total || 0), 0),
    [initialInvoices],
  );
  const paidTotal = useMemo(
    () => initialInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.total || 0), 0),
    [initialInvoices],
  );

  function setLine(i: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }
  function removeLine(i: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }
  function resetForm() {
    setClientName("");
    setClientEmail("");
    setDueDate("");
    setTaxPct("0");
    setNotes("");
    setLines([emptyLine()]);
  }

  async function createInvoice() {
    const cleanLines = lines
      .map((l) => ({ description: l.description.trim(), quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0 }))
      .filter((l) => l.description);
    if (cleanLines.length === 0) {
      setError("Add at least one line item with a description.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/books/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          clientEmail,
          dueDate: dueDate || null,
          taxRate: (Number(taxPct) || 0) / 100,
          notes,
          lines: cleanLines,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not create the invoice.");
      resetForm();
      setShowForm(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the invoice.");
    } finally {
      setCreating(false);
    }
  }

  async function changeStatus(id: string, status: InvoiceStatus) {
    setBusyId(id);
    try {
      const res = await fetch("/api/dashboard/books/invoices/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = (await res.json()) as { ok?: boolean };
      if (res.ok && data.ok) router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">Dashboard / Books</div>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Receipt className="h-6 w-6 text-blue-600" strokeWidth={2} />
            Books
          </h1>
          <p className="mt-1 text-sm text-slate-500">Create and track client invoices.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          {showForm ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          New invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Invoices" value={String(initialInvoices.length)} tone="slate" />
        <Stat label="Outstanding" value={formatMoney(outstanding)} tone="amber" />
        <Stat label="Paid" value={formatMoney(paidTotal)} tone="emerald" />
      </div>

      {/* Create form */}
      {showForm && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">New invoice</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Client name</span>
              <input className={input} value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. Hong Yang" />
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Client email (optional)</span>
              <input className={input} value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="client@email.com" />
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Due date (optional)</span>
              <input type="date" className={input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Tax rate %</span>
              <input className={input} value={taxPct} onChange={(e) => setTaxPct(e.target.value)} inputMode="decimal" placeholder="0" />
            </div>
          </div>

          {/* Line items */}
          <div className="mt-4">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">Line items</span>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className={`${input} flex-1`}
                    value={l.description}
                    onChange={(e) => setLine(i, { description: e.target.value })}
                    placeholder="Description"
                  />
                  <input
                    className={`${input} w-16 text-right`}
                    value={l.quantity}
                    onChange={(e) => setLine(i, { quantity: e.target.value })}
                    inputMode="decimal"
                    placeholder="Qty"
                  />
                  <input
                    className={`${input} w-24 text-right`}
                    value={l.unitPrice}
                    onChange={(e) => setLine(i, { unitPrice: e.target.value })}
                    inputMode="decimal"
                    placeholder="Price"
                  />
                  <span className="w-24 text-right text-sm text-slate-600">
                    {formatMoney((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0))}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addLine} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">
              <Plus className="h-3.5 w-3.5" /> Add line
            </button>
          </div>

          {/* Totals */}
          <div className="mt-4 ml-auto w-full max-w-[16rem] space-y-1 text-sm">
            <Row label="Subtotal" value={formatMoney(totals.subtotal)} />
            <Row label={`Tax (${Number(taxPct) || 0}%)`} value={formatMoney(totals.taxAmount)} />
            <Row label="Total" value={formatMoney(totals.total)} bold />
          </div>

          <div className="mt-3">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">Notes (optional)</span>
            <textarea className={`${input} min-h-[60px]`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment terms, thank-you note, etc." />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void createInvoice()}
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create invoice"}
            </button>
            {error && <span className="text-xs font-medium text-rose-600">{error}</span>}
          </div>
        </section>
      )}

      {/* Invoice list */}
      {initialInvoices.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">No invoices yet. Create your first one above.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {initialInvoices.map((inv) => (
            <li key={inv.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{inv.invoice_number}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${STATUS_TONE[inv.status] ?? STATUS_TONE.draft}`}>
                    {inv.status}
                  </span>
                </div>
                <p className="truncate text-xs text-slate-500">
                  {inv.client_name || "—"}
                  {inv.due_date ? ` · due ${inv.due_date}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-slate-900">{formatMoney(Number(inv.total), inv.currency || "USD")}</span>
              <div className="flex shrink-0 items-center gap-1">
                {inv.status === "draft" && (
                  <button type="button" onClick={() => void changeStatus(inv.id, "sent")} disabled={busyId === inv.id} className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                    Mark sent
                  </button>
                )}
                {inv.status !== "paid" && inv.status !== "void" && (
                  <button type="button" onClick={() => void changeStatus(inv.id, "paid")} disabled={busyId === inv.id} className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                    Mark paid
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "slate" | "amber" | "emerald" }) {
  const palette: Record<string, string> = {
    slate: "bg-slate-50 text-slate-900",
    amber: "bg-amber-50 text-amber-900",
    emerald: "bg-emerald-50 text-emerald-900",
  };
  return (
    <div className={`rounded-xl px-3 py-2.5 ${palette[tone]}`}>
      <div className="text-xs font-medium uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "border-t border-slate-200 pt-1 font-semibold text-slate-900" : "text-slate-600"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
