"use client";

import React, { useState } from "react";

type ListingSummary = {
  id: string;
  address: string;
  city?: string;
  zip?: string;
  price?: number;
};

export function ListingLeadActions({
  listing,
  compact = false,
}: {
  listing: ListingSummary;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });

  async function submit(actionType: "ask_agent" | "contact_agent") {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/listings/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          listingId: listing.id,
          listingAddress: listing.address,
          city: listing.city,
          zip: listing.zip,
          price: listing.price,
          actionType,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to submit");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {!open ? (
        <div className={`flex ${compact ? "flex-col" : "flex-wrap"} gap-3`}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-medium text-white"
          >
            Ask an Agent
          </button>
          {!compact ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-2xl border px-5 py-3 text-sm font-medium text-gray-900"
            >
              Contact Agent
            </button>
          ) : null}
        </div>
      ) : done ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Thanks — your request was sent to the CRM and will be routed to an agent.
        </div>
      ) : (
        <div className="rounded-2xl border bg-gray-50 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="rounded-xl border bg-white px-4 py-3 text-sm"
            />
            <input
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className="rounded-xl border bg-white px-4 py-3 text-sm"
            />
            <input
              placeholder="Phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              className="md:col-span-2 rounded-xl border bg-white px-4 py-3 text-sm"
            />
            <textarea
              placeholder="Questions or notes"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={4}
              className="md:col-span-2 rounded-2xl border bg-white px-4 py-3 text-sm"
            />
          </div>

          {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!form.name || !form.email || loading}
              onClick={() => void submit("ask_agent")}
              className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-medium text-white disabled:bg-gray-300"
            >
              {loading ? "Sending..." : "Send inquiry"}
            </button>
            <button
              type="button"
              disabled={!form.name || !form.email || loading}
              onClick={() => void submit("contact_agent")}
              className="rounded-2xl border px-5 py-3 text-sm font-medium text-gray-900 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Contact Agent"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-2xl border px-5 py-3 text-sm font-medium text-gray-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
