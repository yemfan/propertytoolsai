"use client";

import { useCallback, useEffect, useState } from "react";

type Branding = {
  brandName: string;
  signatureHtml: string;
  logoUrl: string;
};

const empty: Branding = { brandName: "", signatureHtml: "", logoUrl: "" };

export default function BrandingSettingsPanel() {
  const [branding, setBranding] = useState<Branding>(empty);
  const [saved, setSaved] = useState<Branding>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDirty =
    branding.brandName !== saved.brandName ||
    branding.signatureHtml !== saved.signatureHtml ||
    branding.logoUrl !== saved.logoUrl;

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/branding");
      const body = await res.json().catch(() => ({}));
      if (body.ok && body.branding) {
        setBranding(body.branding);
        setSaved(body.branding);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branding),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Save failed");
      setSaved({ ...branding });
      setMessage("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500 py-4">Loading branding...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-gray-500">Brand Name</label>
        <input
          value={branding.brandName}
          onChange={(e) => setBranding((b) => ({ ...b, brandName: e.target.value }))}
          placeholder="e.g. Michael Ye Real Estate"
          maxLength={200}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-[11px] text-gray-500">
          Used in email signatures, reports, and client-facing messages.
        </p>
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-gray-500">Logo URL</label>
        <input
          value={branding.logoUrl}
          onChange={(e) => setBranding((b) => ({ ...b, logoUrl: e.target.value }))}
          placeholder="https://example.com/logo.png"
          maxLength={500}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-[11px] text-gray-500">
          Link to your logo image. Appears in presentations and email headers.
        </p>
        {branding.logoUrl && (
          <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 inline-block">
            <img
              src={branding.logoUrl}
              alt="Logo preview"
              className="max-h-16 max-w-[200px] object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-gray-500">
          Email Signature <span className="text-gray-400 font-normal">(HTML, optional)</span>
        </label>
        <textarea
          value={branding.signatureHtml}
          onChange={(e) => setBranding((b) => ({ ...b, signatureHtml: e.target.value }))}
          placeholder={"<p>Best regards,</p>\n<p><strong>Your Name</strong><br/>Your Brokerage<br/>(555) 123-4567</p>"}
          maxLength={2000}
          rows={5}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
        />
        <p className="text-[11px] text-gray-500">
          Custom HTML appended to outbound emails. Leave blank to use the default signature.
        </p>
        {branding.signatureHtml && (
          <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3">
            <div className="text-[11px] font-medium text-gray-500 mb-1">Preview</div>
            <div
              className="text-sm text-gray-700 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: branding.signatureHtml }}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !isDirty}
          className="rounded-lg bg-brand-accent text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {message && <span className="text-sm text-green-700">{message}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
