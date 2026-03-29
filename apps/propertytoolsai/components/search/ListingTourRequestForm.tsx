"use client";

import React, { useState } from "react";

type ListingTourSummary = {
  id: string;
  address: string;
  city?: string;
  zip?: string;
  price?: number;
};

export function ListingTourRequestForm({ listing }: { listing: ListingTourSummary }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    requestedTime: "",
    notes: "",
  });

  async function submit() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/listings/schedule-tour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          listingId: listing.id,
          listingAddress: listing.address,
          city: listing.city,
          zip: listing.zip,
          price: listing.price,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to request tour");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request tour");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        Tour request submitted — your lead was routed into the CRM.
      </div>
    );
  }

  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Schedule a Tour</h2>
      <p className="mt-2 text-sm text-gray-600 md:text-base">Request a time to see {listing.address}.</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          className="rounded-xl border px-4 py-3 text-sm"
        />
        <input
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          className="rounded-xl border px-4 py-3 text-sm"
        />
        <input
          placeholder="Phone"
          type="tel"
          value={form.phone}
          onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
          className="rounded-xl border px-4 py-3 text-sm"
        />
        <input
          placeholder="Preferred tour time"
          value={form.requestedTime}
          onChange={(e) => setForm((prev) => ({ ...prev, requestedTime: e.target.value }))}
          className="rounded-xl border px-4 py-3 text-sm"
        />
        <textarea
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          rows={4}
          className="md:col-span-2 rounded-2xl border px-4 py-3 text-sm"
        />
      </div>

      {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}

      <div className="mt-4">
        <button
          type="button"
          disabled={!form.name || !form.email || !form.requestedTime || loading}
          onClick={() => void submit()}
          className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-medium text-white disabled:bg-gray-300"
        >
          {loading ? "Submitting..." : "Request Tour"}
        </button>
      </div>
    </section>
  );
}
