"use client";

import { useMemo, useState } from "react";
import QRCode from "react-qr-code";

type PropertyRow = {
  id: string;
  address: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
};

type LeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  property_address: string | null;
  source: string | null;
  lead_status: string | null;
  created_at: string;
};

function labelForProperty(p: PropertyRow) {
  return p.address?.trim() || [p.city, p.state, p.zip_code].filter(Boolean).join(", ") || p.id;
}

export default function OpenHousesClient({
  agentId,
  properties,
  leads,
}: {
  agentId: string;
  properties: PropertyRow[];
  leads: LeadRow[];
}) {
  const [search, setSearch] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    properties[0]?.id ?? ""
  );
  const [copied, setCopied] = useState(false);

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  const filteredProperties = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return properties;
    return properties.filter((p) => labelForProperty(p).toLowerCase().includes(s));
  }, [properties, search]);

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId) ?? properties[0];

  const signupUrl = useMemo(() => {
    if (!selectedProperty?.id) return "";
    return `${origin}/open-house-signup?property_id=${encodeURIComponent(
      selectedProperty.id
    )}&agent_id=${encodeURIComponent(agentId)}`;
  }, [origin, selectedProperty?.id, agentId]);

  const attendees = useMemo(() => {
    if (!selectedProperty?.address) return [];
    const address = selectedProperty.address.trim().toLowerCase();
    // open-house-lead stores `property_address` resolved from the warehouse.
    return leads.filter((l) => (l.property_address ?? "").trim().toLowerCase() === address);
  }, [leads, selectedProperty?.address]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(signupUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("Copy failed", e);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-brand-text">Open Houses</h1>
        <p className="text-sm text-brand-text/80">
          Pick a property to generate its QR code and view attendee sign-ups.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-end lg:justify-between">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-brand-text mb-2">
              Search properties
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Start typing an address..."
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div className="flex-1">
            <label className="block text-xs font-semibold text-brand-text mb-2">
              Select property
            </label>
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-primary"
            >
              {filteredProperties.slice(0, 50).map((p) => (
                <option key={p.id} value={p.id}>
                  {labelForProperty(p)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedProperty ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="md:col-span-1 bg-brand-surface border border-gray-200 rounded-2xl p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                QR Code
              </div>
              <div className="mt-3 flex justify-center">
                <QRCode value={signupUrl} size={160} />
              </div>
              <div className="mt-3 text-[11px] text-slate-500 font-mono break-all">
                property_id: {selectedProperty.id}
              </div>
            </div>

            <div className="md:col-span-2 space-y-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {labelForProperty(selectedProperty)}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Scanning will open the mobile sign-up form and create an <span className="font-semibold">Open House</span> lead.
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-700">Sign-up link</div>
                <input
                  readOnly
                  value={signupUrl}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono bg-white"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={copyLink}
                className="text-sm font-semibold px-4 py-2 rounded-xl bg-brand-primary text-white hover:bg-[#005ca8]"
                >
                  {copied ? "Copied!" : "Copy link"}
                </button>
                <a
                  href={signupUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
                >
                  Open on phone
                </a>
              </div>
            </div>
          </div>
        ) : null}

        <div className="pt-2 border-t border-slate-100">
          <div className="text-sm font-semibold text-slate-900">QR Codes (Recent Properties)</div>
          <div className="text-xs text-slate-600 mt-1">
            Click a card to switch the active QR code and refresh the attendee list below.
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProperties.slice(0, 8).map((p) => {
              const url = `${origin}/open-house-signup?property_id=${encodeURIComponent(p.id)}&agent_id=${encodeURIComponent(agentId)}`;
              const active = p.id === selectedPropertyId;
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setSelectedPropertyId(p.id)}
                  className={
                    "text-left rounded-2xl border p-3 transition-colors " +
                    (active
                  ? "border-brand-primary/40 bg-brand-surface"
                      : "border-gray-200 bg-white hover:bg-brand-surface")
                  }
                >
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    {labelForProperty(p)}
                  </div>
                  <div className="mt-2 flex justify-center bg-brand-surface border border-gray-200 rounded-xl p-2">
                    <QRCode value={url} size={78} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Attendee List</div>
              <div className="text-xs text-slate-600 mt-1">
                Source tagged as <span className="font-semibold">Open House</span>.
              </div>
            </div>
            <div className="text-xs font-semibold text-slate-700">
              {attendees.length} attendee{attendees.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Name</th>
                <th className="text-left px-4 py-3 font-semibold">Email</th>
                <th className="text-left px-4 py-3 font-semibold">Phone</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {attendees.length ? (
                attendees
                  .slice(0, 200)
                  .map((l) => (
                    <tr key={l.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">{l.name ?? "—"}</td>
                      <td className="px-4 py-3">{l.email ?? "—"}</td>
                      <td className="px-4 py-3">{l.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{l.lead_status ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {new Date(l.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-slate-600">
                    No attendees yet for this property. Print the QR and share it at the open house.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

