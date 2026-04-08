"use client";

import { useCallback, useMemo, useRef, useState } from "react";
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
  const [generatingFlyer, setGeneratingFlyer] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

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

  async function downloadFlyer() {
    if (!selectedProperty) return;
    setGeneratingFlyer(true);
    setShareMsg(null);
    try {
      // Render QR code to canvas via the SVG
      const qrSvg = qrRef.current?.querySelector("svg");
      let qrDataUrl = "";
      if (qrSvg) {
        const svgData = new XMLSerializer().serializeToString(qrSvg);
        const canvas = document.createElement("canvas");
        canvas.width = 600;
        canvas.height = 600;
        const ctx = canvas.getContext("2d");
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => { ctx?.drawImage(img, 0, 0, 600, 600); resolve(); };
          img.onerror = reject;
          img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
        });
        qrDataUrl = canvas.toDataURL("image/png");
      }

      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();
      const addr = labelForProperty(selectedProperty);

      // === Professional Flyer Layout ===

      // Top accent bar
      doc.setFillColor(0, 114, 206); // brand blue
      doc.rect(0, 0, w, 8, "F");

      // "OPEN HOUSE" title
      doc.setFontSize(42);
      doc.setTextColor(15, 23, 42);
      doc.text("OPEN HOUSE", w / 2, 35, { align: "center" });

      // Decorative line
      doc.setDrawColor(0, 114, 206);
      doc.setLineWidth(0.8);
      doc.line(w / 2 - 30, 40, w / 2 + 30, 40);

      // "You're Invited" subtitle
      doc.setFontSize(16);
      doc.setTextColor(100, 116, 139);
      doc.text("You're Invited!", w / 2, 50, { align: "center" });

      // Property address (large)
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42);
      doc.text(addr, w / 2, 68, { align: "center", maxWidth: w - 40 });

      // Address underline
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.3);
      doc.line(30, 74, w - 30, 74);

      // Info box background
      doc.setFillColor(248, 250, 252); // slate-50
      doc.roundedRect(25, 80, w - 50, 30, 3, 3, "F");

      // Info text inside box
      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      doc.text("Scan the QR code below to:", w / 2, 90, { align: "center" });
      doc.setFontSize(10);
      doc.text("\u2022  Register for the open house    \u2022  Get your free property report", w / 2, 100, { align: "center" });

      // QR code (centered, large)
      if (qrDataUrl) {
        const qrSize = 70;
        doc.addImage(qrDataUrl, "PNG", (w - qrSize) / 2, 118, qrSize, qrSize);
      }

      // "SCAN ME" label
      doc.setFillColor(0, 114, 206);
      doc.roundedRect(w / 2 - 18, 192, 36, 10, 2, 2, "F");
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text("SCAN ME", w / 2, 199, { align: "center" });

      // Signup URL (small, below QR)
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(signupUrl, w / 2, 210, { align: "center", maxWidth: w - 40 });

      // Bottom section divider
      doc.setDrawColor(229, 231, 235);
      doc.line(30, 220, w - 30, 220);

      // What to expect section
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("What to Expect", w / 2, 232, { align: "center" });

      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const features = [
        "\u2022  Tour the property at your own pace",
        "\u2022  Meet the listing agent and ask questions",
        "\u2022  Receive a complimentary home value report",
      ];
      features.forEach((f, i) => {
        doc.text(f, w / 2, 242 + i * 7, { align: "center" });
      });

      // Bottom accent bar
      doc.setFillColor(0, 114, 206);
      doc.rect(0, h - 12, w, 12, "F");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text("Powered by LeadSmart AI", w / 2, h - 4, { align: "center" });

      doc.save(`open-house-flyer-${selectedProperty.id.slice(0, 8)}.pdf`);
    } catch (e) {
      console.error("Flyer generation failed", e);
      setShareMsg("Flyer generation failed. Please try again.");
    } finally {
      setGeneratingFlyer(false);
    }
  }

  async function shareReport() {
    if (!shareEmail.trim() || !selectedProperty) return;
    setSharing(true);
    setShareMsg(null);
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: shareEmail.trim(),
          subject: `Open House Report: ${labelForProperty(selectedProperty)}`,
          text: `Hi,\n\nHere is the open house report for ${labelForProperty(selectedProperty)}.\n\nSign-up link: ${signupUrl}\n\nThis report includes estimated home value, market comparables, and investment insights.\n\nBest regards`,
        }),
      });
      if (res.ok) {
        setShareMsg("Report sent!");
        setShareEmail("");
        setTimeout(() => { setShareMsg(null); setShareOpen(false); }, 2000);
      } else {
        setShareMsg("Failed to send. Please try again.");
      }
    } catch {
      setShareMsg("Network error.");
    } finally {
      setSharing(false);
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
              <div ref={qrRef} className="mt-3 flex justify-center bg-white p-2 rounded-xl">
                <QRCode value={signupUrl} size={160} />
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
                <button
                  type="button"
                  disabled={generatingFlyer}
                  onClick={() => void downloadFlyer()}
                  className="text-sm font-semibold px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {generatingFlyer ? "Generating..." : "Download Flyer (PDF)"}
                </button>
                <button
                  type="button"
                  onClick={() => setShareOpen(!shareOpen)}
                  className="text-sm font-semibold px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
                >
                  Share Report
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

              {shareOpen && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Email the open house report to:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      placeholder="seller@example.com"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                    <button
                      type="button"
                      disabled={sharing || !shareEmail.trim()}
                      onClick={() => void shareReport()}
                      className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#005ca8] disabled:opacity-50"
                    >
                      {sharing ? "Sending..." : "Send"}
                    </button>
                  </div>
                  {shareMsg && (
                    <p className={`text-xs ${shareMsg.includes("sent") ? "text-green-700" : "text-red-600"}`}>
                      {shareMsg}
                    </p>
                  )}
                </div>
              )}
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

