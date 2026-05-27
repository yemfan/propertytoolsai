"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createEstimate, type EstimateLine } from "@/lib/actions/estimates";

interface Client {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email: string | null;
}

interface Props {
  clients: Client[];
  preselectedClientId?: string;
}

function emptyLine(): EstimateLine & { key: string } {
  return {
    key: crypto.randomUUID(),
    description: "",
    quantity: 1,
    unit_price: 0,
    amount: 0,
  };
}

function defaultExpiryDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export function EstimateBuilder({ clients, preselectedClientId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState(preselectedClientId ?? "");
  const [expiryDate, setExpiryDate] = useState(defaultExpiryDate());
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<(EstimateLine & { key: string })[]>([
    emptyLine(),
  ]);

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const taxAmount = +(subtotal * (taxRate / 100)).toFixed(2);
  const total = subtotal + taxAmount;

  function updateLine(key: string, field: string, raw: string) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const updated: EstimateLine & { key: string } = {
          ...l,
          [field]: raw,
        };
        if (field === "quantity" || field === "unit_price") {
          updated.quantity =
            field === "quantity" ? Number(raw) : l.quantity;
          updated.unit_price =
            field === "unit_price" ? Number(raw) : l.unit_price;
          updated.amount = +(updated.quantity * updated.unit_price).toFixed(2);
        }
        return updated;
      })
    );
  }

  function submit() {
    if (!expiryDate) {
      setError("Expiry date is required");
      return;
    }
    const validLines = lines.filter((l) => l.description.trim());
    if (!validLines.length) {
      setError("Add at least one line item");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const id = await createEstimate({
          clientId: clientId || null,
          expiryDate,
          taxRate: taxRate / 100,
          notes,
          lines: validLines,
        });
        router.push(`/books/estimates/${id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      }
    });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Client */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Client
          </label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="">No client</option>
            {clients.map((c) => {
              const name =
                [c.first_name, c.last_name].filter(Boolean).join(" ") ||
                c.company ||
                c.id;
              return (
                <option key={c.id} value={c.id}>
                  {name} {c.email ? `(${c.email})` : ""}
                </option>
              );
            })}
          </select>
        </div>

        {/* Expiry date */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Valid until (expiry date)
          </label>
          <input
            type="date"
            required
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Line items */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Line Items
          </h3>
          <button
            type="button"
            onClick={() => setLines((p) => [...p, emptyLine()])}
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add line
          </button>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_80px_100px_100px_36px] gap-3 mb-2 px-1">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
            Description
          </span>
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
            Qty
          </span>
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
            Unit price
          </span>
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide text-right">
            Amount
          </span>
        </div>

        <div className="space-y-2">
          {lines.map((line) => (
            <div
              key={line.key}
              className="grid grid-cols-[1fr_80px_100px_100px_36px] gap-3 items-center"
            >
              <input
                type="text"
                value={line.description}
                onChange={(e) =>
                  updateLine(line.key, "description", e.target.value)
                }
                placeholder="Service or product"
                className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="number"
                value={line.quantity}
                onChange={(e) =>
                  updateLine(line.key, "quantity", e.target.value)
                }
                min={1}
                step={1}
                className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
              />
              <input
                type="number"
                value={line.unit_price}
                onChange={(e) =>
                  updateLine(line.key, "unit_price", e.target.value)
                }
                min={0}
                step={0.01}
                placeholder="0.00"
                className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="text-sm text-slate-700 font-medium tabular-nums text-right pr-1">
                ${line.amount.toFixed(2)}
              </div>
              <button
                type="button"
                onClick={() =>
                  setLines((p) => p.filter((l) => l.key !== line.key))
                }
                disabled={lines.length === 1}
                className="p-1.5 text-slate-300 hover:text-rose-500 disabled:opacity-20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Tax + totals */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Tax rate (%)
          </label>
          <input
            type="number"
            value={taxRate}
            onChange={(e) => setTaxRate(Number(e.target.value))}
            min={0}
            max={100}
            step={0.01}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-2">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="tabular-nums">${subtotal.toFixed(2)}</span>
          </div>
          {taxRate > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Tax ({taxRate}%)</span>
              <span className="tabular-nums">${taxAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-slate-900 border-t border-slate-200 pt-2">
            <span>Total</span>
            <span className="tabular-nums font-mono">${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="mb-6">
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Notes{" "}
          <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Scope of work, terms, assumptions…"
          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {/* Action */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="px-6 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors"
        >
          {isPending ? "Creating…" : "Create estimate"}
        </button>
      </div>
    </div>
  );
}
