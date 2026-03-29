"use client";

import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (leadId: string) => void;
};

export function NewContactModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [property_address, setPropertyAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [forceCreate, setForceCreate] = useState(false);
  const [dupHint, setDupHint] = useState<string | null>(null);
  const [dupLeadId, setDupLeadId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/contacts/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || null,
          email: email || null,
          phone: phone || null,
          property_address: property_address || null,
          notes: notes || null,
          source: "manual_entry",
          forceCreate,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409 && body.duplicate) {
        setDupHint(
          `Possible duplicate (score ${body.duplicate.score ?? ""}). Existing lead #${body.duplicate.leadId ?? ""}`
        );
        setDupLeadId(String(body.duplicate.leadId ?? ""));
        setError("A similar contact exists. Check the box below to create anyway.");
        return;
      }
      if (!res.ok) throw new Error(body.error || "Could not save contact");
      onCreated?.(String(body.leadId ?? ""));
      onClose();
      setName("");
      setEmail("");
      setPhone("");
      setPropertyAddress("");
      setNotes("");
      setForceCreate(false);
      setDupHint(null);
      setDupLeadId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">New contact</h2>
            <p className="text-sm text-gray-600">Adds a lead through the shared intake pipeline (dedupe, enrich, CRM).</p>
          </div>
          <button type="button" className="text-gray-500 hover:text-gray-800" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Name
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Email
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Phone
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder="10-digit US"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Property / address
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={property_address}
              onChange={(e) => setPropertyAddress(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Notes
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>

        {dupHint ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {dupHint}
            {dupLeadId ? (
              <span className="block text-gray-600 mt-1">Lead ID: {dupLeadId}</span>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

        <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={forceCreate}
            onChange={(e) => setForceCreate(e.target.checked)}
          />
          Create anyway (ignore duplicate warning)
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            disabled={saving}
            onClick={() => void submit()}
          >
            {saving ? "Saving…" : "Save contact"}
          </button>
        </div>
      </div>
    </div>
  );
}
