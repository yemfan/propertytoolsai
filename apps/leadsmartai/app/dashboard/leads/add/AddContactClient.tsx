"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AddContactClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [property_address, setPropertyAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [forceCreate, setForceCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dup, setDup] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    setDup(null);
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
      if (res.status === 409) {
        setDup(
          body.duplicate
            ? `Possible duplicate — lead #${body.duplicate.leadId} (score ${body.duplicate.score})`
            : body.message || "Duplicate"
        );
        return;
      }
      if (!res.ok) throw new Error(body.error || "Could not save");
      router.push("/dashboard/leads");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8 pb-24 sm:pb-8">
      <Link href="/dashboard/leads" className="text-sm font-medium text-gray-600">
        ← Leads
      </Link>
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Add contact</h1>
        <p className="text-sm text-gray-600">Mobile-friendly form · same validation and intake pipeline as desktop.</p>
      </header>

      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-gray-800">
          Name
          <input
            className="mt-1 w-full min-h-[44px] rounded-xl border border-gray-300 px-3 text-base"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-gray-800">
          Email
          <input
            className="mt-1 w-full min-h-[44px] rounded-xl border border-gray-300 px-3 text-base"
            inputMode="email"
            autoCapitalize="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-gray-800">
          Phone
          <input
            className="mt-1 w-full min-h-[44px] rounded-xl border border-gray-300 px-3 text-base"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-gray-800">
          Property / address
          <input
            className="mt-1 w-full min-h-[44px] rounded-xl border border-gray-300 px-3 text-base"
            value={property_address}
            onChange={(e) => setPropertyAddress(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-gray-800">
          Notes
          <textarea
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-base"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        {dup ? <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{dup}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={forceCreate} onChange={(e) => setForceCreate(e.target.checked)} />
          Create anyway if duplicate
        </label>

        <button
          type="button"
          disabled={saving}
          className="w-full min-h-[48px] rounded-xl bg-gray-900 text-white text-base font-medium disabled:opacity-50"
          onClick={() => void submit()}
        >
          {saving ? "Saving…" : "Save to CRM"}
        </button>
      </div>
    </div>
  );
}
