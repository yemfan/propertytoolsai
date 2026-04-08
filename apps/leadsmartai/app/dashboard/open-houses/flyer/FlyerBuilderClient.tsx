"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import AddressAutocomplete from "@/components/AddressAutocomplete";

type PropertyData = {
  address: string;
  city: string | null;
  state: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  propertyType: string | null;
  yearBuilt: number | null;
  estimatedValue: number | null;
  propertyId: string;
};

type AgentInfo = {
  name: string;
  email: string;
  phone: string;
  avatarUrl: string;
  brandName: string;
  logoUrl: string;
};

export default function FlyerBuilderClient() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Property data (editable)
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [description, setDescription] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  // Agent info
  const [agent, setAgent] = useState<AgentInfo>({ name: "", email: "", phone: "", avatarUrl: "", brandName: "", logoUrl: "" });

  // PDF generation
  const [generating, setGenerating] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const origin = useMemo(() => typeof window !== "undefined" ? window.location.origin : "", []);
  const signupUrl = useMemo(() => {
    if (!property?.propertyId) return "";
    return `${origin}/open-house-signup?property_id=${encodeURIComponent(property.propertyId)}&agent_id=`;
  }, [origin, property?.propertyId]);

  // Load agent info on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/me").then((r) => r.json()).catch(() => ({})),
      fetch("/api/dashboard/branding").then((r) => r.json()).catch(() => ({})),
    ]).then(([me, branding]) => {
      setAgent({
        name: me?.full_name || me?.email?.split("@")[0] || "",
        email: me?.email || "",
        phone: me?.phone || "",
        avatarUrl: me?.avatar_url || "",
        brandName: branding?.branding?.brandName || "",
        logoUrl: branding?.branding?.logoUrl || "",
      });
    });
  }, []);

  async function fetchProperty() {
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/flyer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Could not find property");
      setProperty(body.property);
      setDescription(body.description ?? "");
      setListingPrice(body.property.estimatedValue ? `$${Math.round(body.property.estimatedValue).toLocaleString()}` : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  function onPhotoUpload(files: FileList | null) {
    if (!files) return;
    const remaining = 4 - photos.length;
    const toAdd = Array.from(files).slice(0, remaining);
    for (const file of toAdd) {
      const reader = new FileReader();
      reader.onload = () => setPhotos((prev) => [...prev.slice(0, 3), reader.result as string]);
      reader.readAsDataURL(file);
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function downloadPdf() {
    if (!property) return;
    setGenerating(true);
    try {
      // Get QR code as image
      const qrSvg = qrRef.current?.querySelector("svg");
      let qrDataUrl = "";
      if (qrSvg) {
        const svgData = new XMLSerializer().serializeToString(qrSvg);
        const canvas = document.createElement("canvas");
        canvas.width = 600; canvas.height = 600;
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

      // Top accent
      doc.setFillColor(0, 114, 206);
      doc.rect(0, 0, w, 6, "F");

      // OPEN HOUSE title
      doc.setFontSize(36);
      doc.setTextColor(15, 23, 42);
      doc.text("OPEN HOUSE", w / 2, 22, { align: "center" });
      doc.setDrawColor(0, 114, 206);
      doc.setLineWidth(0.6);
      doc.line(w / 2 - 25, 26, w / 2 + 25, 26);

      // Address
      doc.setFontSize(16);
      doc.text(property.address, w / 2, 36, { align: "center", maxWidth: w - 30 });
      if (property.city || property.state) {
        doc.setFontSize(11);
        doc.setTextColor(100, 116, 139);
        doc.text([property.city, property.state].filter(Boolean).join(", "), w / 2, 43, { align: "center" });
      }

      // Listing price
      if (listingPrice) {
        doc.setFontSize(22);
        doc.setTextColor(0, 114, 206);
        doc.text(listingPrice, w / 2, 55, { align: "center" });
      }

      // Property details row
      let detailY = 62;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(20, detailY - 4, w - 40, 12, 2, 2, "F");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      const details = [
        property.beds ? `${property.beds} Beds` : null,
        property.baths ? `${property.baths} Baths` : null,
        property.sqft ? `${property.sqft.toLocaleString()} Sqft` : null,
        property.yearBuilt ? `Built ${property.yearBuilt}` : null,
        property.propertyType ? property.propertyType : null,
      ].filter(Boolean).join("  |  ");
      doc.text(details, w / 2, detailY + 3, { align: "center" });

      // Photos
      let photoY = 78;
      if (photos.length > 0) {
        const photoW = photos.length === 1 ? w - 40 : (w - 46) / 2;
        const photoH = 40;
        photos.slice(0, 4).forEach((src, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x = 20 + col * (photoW + 6);
          const y = photoY + row * (photoH + 4);
          try { doc.addImage(src, "JPEG", x, y, photoW, photoH); } catch { /* skip bad images */ }
        });
        photoY += (Math.ceil(photos.length / 2)) * 44 + 4;
      }

      // Description
      if (description) {
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        const lines = doc.splitTextToSize(description, w - 44);
        doc.text(lines, w / 2, photoY + 2, { align: "center" });
        photoY += lines.length * 4.5 + 6;
      }

      // Divider
      doc.setDrawColor(229, 231, 235);
      doc.line(25, photoY, w - 25, photoY);
      photoY += 6;

      // Agent section + QR code side by side
      const agentX = 25;
      const qrX = w - 70;

      // Agent info
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("YOUR AGENT", agentX, photoY);
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(agent.name || "Your Agent", agentX, photoY + 7);
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      if (agent.phone) doc.text(agent.phone, agentX, photoY + 13);
      if (agent.email) doc.text(agent.email, agentX, photoY + 18);
      if (agent.brandName) {
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(agent.brandName, agentX, photoY + 24);
      }

      // QR code
      if (qrDataUrl) {
        doc.addImage(qrDataUrl, "PNG", qrX, photoY - 2, 40, 40);
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text("Scan to register", qrX + 20, photoY + 40, { align: "center" });
      }

      // Bottom bar
      doc.setFillColor(0, 114, 206);
      doc.rect(0, h - 10, w, 10, "F");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text("Powered by LeadSmart AI", w / 2, h - 3, { align: "center" });

      doc.save(`open-house-${property.address.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 30)}.pdf`);
    } catch (e) {
      console.error("PDF generation failed", e);
      setError("PDF generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  // === RENDER ===

  // Step 1: Address input
  if (!property) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Open House Flyer Builder</h1>
          <p className="text-sm text-gray-500">Enter a property address to generate a professional flyer.</p>
        </div>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</div>}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <label className="block text-sm font-medium text-gray-700">Property Address</label>
          <AddressAutocomplete
            value={address}
            onChange={(v) => setAddress(v)}
            onSelect={(v) => setAddress(v.formattedAddress)}
            placeholder="Start typing an address..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void fetchProperty()}
            disabled={loading || !address.trim()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? "Loading property..." : "Generate Flyer"}
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Preview + Edit
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Open House Flyer</h1>
          <p className="text-sm text-gray-500">Edit details below, then download your flyer.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setProperty(null)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Start Over
          </button>
          <button onClick={() => void downloadPdf()} disabled={generating} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
            {generating ? "Generating PDF..." : "Download PDF"}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</div>}

      {/* Live Preview Card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white text-center">
          <h2 className="text-2xl font-bold tracking-tight">OPEN HOUSE</h2>
        </div>

        <div className="p-6 space-y-5">
          {/* Address + Price */}
          <div className="text-center space-y-2">
            <input
              value={property.address}
              onChange={(e) => setProperty((p) => p ? { ...p, address: e.target.value } : p)}
              className="w-full text-center text-lg font-semibold text-gray-900 border-0 border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none pb-1"
            />
            <div className="flex items-center justify-center gap-2">
              <label className="text-xs text-gray-500">Listing Price:</label>
              <input
                value={listingPrice}
                onChange={(e) => setListingPrice(e.target.value)}
                placeholder="$000,000"
                className="text-xl font-bold text-blue-600 border-0 border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none text-center w-40"
              />
            </div>
          </div>

          {/* Property Details (editable) */}
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: "Beds", value: String(property.beds ?? ""), key: "beds" },
              { label: "Baths", value: String(property.baths ?? ""), key: "baths" },
              { label: "Sqft", value: String(property.sqft ?? ""), key: "sqft" },
              { label: "Year", value: String(property.yearBuilt ?? ""), key: "yearBuilt" },
              { label: "Type", value: property.propertyType ?? "", key: "propertyType" },
            ].map((f) => (
              <div key={f.key} className="text-center">
                <label className="block text-[10px] text-gray-500">{f.label}</label>
                <input
                  value={f.value}
                  onChange={(e) => setProperty((p) => p ? { ...p, [f.key]: e.target.value } : p)}
                  className="w-full text-center text-sm font-medium border rounded-lg border-gray-200 px-1 py-1 focus:border-blue-500 focus:outline-none"
                />
              </div>
            ))}
          </div>

          {/* Photos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">Photos ({photos.length}/4)</span>
              {photos.length < 4 && (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Upload Photo
                </button>
              )}
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onPhotoUpload(e.target.files); e.target.value = ""; }} />
            {photos.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {photos.map((src, i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden border border-gray-200">
                    <img src={src} alt={`Photo ${i + 1}`} className="h-32 w-full object-cover" />
                    <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white hover:bg-black/70">Remove</button>
                  </div>
                ))}
              </div>
            ) : (
              <div
                onClick={() => photoInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/50 py-8 transition hover:border-blue-400 hover:bg-blue-50/30"
              >
                <span className="text-sm text-gray-500">Click to upload property photos</span>
                <span className="text-xs text-gray-400 mt-1">JPG, PNG — up to 4 photos</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-xs font-medium text-gray-500">Description</label>
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">✨ AI Generated</span>
              <span className="text-[10px] text-gray-400">— edit freely</span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200" />

          {/* Agent Info + QR Code */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Your Agent</span>
              <div className="flex items-center gap-3">
                {agent.avatarUrl ? (
                  <img src={agent.avatarUrl} alt="Agent" className="h-12 w-12 rounded-full object-cover border border-gray-200" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-500">
                    {(agent.name || "A").charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <input value={agent.name} onChange={(e) => setAgent((a) => ({ ...a, name: e.target.value }))} className="text-sm font-semibold text-gray-900 border-0 border-b border-dashed border-gray-200 focus:border-blue-500 focus:outline-none" placeholder="Your name" />
                  <input value={agent.phone} onChange={(e) => setAgent((a) => ({ ...a, phone: e.target.value }))} className="block text-xs text-gray-600 border-0 border-b border-dashed border-gray-200 focus:border-blue-500 focus:outline-none mt-0.5" placeholder="Phone" />
                  <input value={agent.email} onChange={(e) => setAgent((a) => ({ ...a, email: e.target.value }))} className="block text-xs text-gray-600 border-0 border-b border-dashed border-gray-200 focus:border-blue-500 focus:outline-none mt-0.5" placeholder="Email" />
                </div>
              </div>
              {agent.brandName && <p className="text-xs text-gray-400">{agent.brandName}</p>}
            </div>

            <div className="text-center shrink-0">
              <div ref={qrRef} className="bg-white p-1 rounded-lg border border-gray-200">
                {signupUrl && <QRCode value={signupUrl} size={100} />}
              </div>
              <p className="text-[10px] text-gray-500 mt-1">Scan to register</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
