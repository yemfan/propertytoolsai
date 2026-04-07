"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Branding = {
  brandName: string;
  signatureHtml: string;
  logoUrl: string;
};

const empty: Branding = { brandName: "", signatureHtml: "", logoUrl: "" };

const DEFAULT_SIGNATURE = `<p>Best regards,</p>
<p><strong>Your Name</strong><br/>Your Brokerage<br/>(555) 123-4567</p>`;

export default function BrandingSettingsPanel() {
  const [branding, setBranding] = useState<Branding>(empty);
  const [saved, setSaved] = useState<Branding>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingSignature, setEditingSignature] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

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
      setEditingSignature(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      setError("Logo must be under 2MB.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const supabase = supabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Sign in required."); return; }

      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/logo-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600",
        contentType: file.type || "image/png",
        upsert: true,
      });
      if (upErr) throw new Error(upErr.message);

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      setBranding((b) => ({ ...b, logoUrl: publicUrl }));

      // Auto-save the logo URL
      await fetch("/api/dashboard/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: publicUrl }),
      });
      setSaved((s) => ({ ...s, logoUrl: publicUrl }));
      setMessage("Logo uploaded.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function removeLogo() {
    setBranding((b) => ({ ...b, logoUrl: "" }));
  }

  const signatureToShow = branding.signatureHtml || DEFAULT_SIGNATURE;

  if (loading) {
    return <div className="text-sm text-gray-500 py-4">Loading branding...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Brand Name */}
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

      {/* Logo */}
      <div className="space-y-2">
        <label className="block text-[11px] font-medium text-gray-500">
          Logo <span className="text-gray-400 font-normal">(optional)</span>
        </label>

        {branding.logoUrl ? (
          <div className="flex items-center gap-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <img
                src={branding.logoUrl}
                alt="Logo"
                className="max-h-16 max-w-[200px] object-contain"
                onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploading}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Change"}
              </button>
              <button
                type="button"
                onClick={removeLogo}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/50 px-4 py-3 text-sm text-gray-500 hover:border-blue-400 hover:bg-blue-50/30 disabled:opacity-50"
          >
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            {uploading ? "Uploading..." : "Upload logo"}
          </button>
        )}

        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadLogo(f);
            e.target.value = "";
          }}
        />
        <p className="text-[11px] text-gray-500">
          PNG, JPG, WebP, or SVG. Max 2MB. Shows in presentations and emails.
        </p>
      </div>

      {/* Email Signature */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-medium text-gray-500">Email Signature</label>
          {!editingSignature && (
            <button
              type="button"
              onClick={() => setEditingSignature(true)}
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              Change
            </button>
          )}
        </div>

        {editingSignature ? (
          <div className="space-y-2">
            <textarea
              value={branding.signatureHtml}
              onChange={(e) => setBranding((b) => ({ ...b, signatureHtml: e.target.value }))}
              placeholder={DEFAULT_SIGNATURE}
              maxLength={2000}
              rows={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
            />
            <p className="text-[11px] text-gray-500">
              HTML format. Leave blank to use the default signature.
            </p>
            {branding.signatureHtml && (
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="text-[11px] font-medium text-gray-500 mb-1">Preview</div>
                <div
                  className="text-sm text-gray-700"
                  dangerouslySetInnerHTML={{ __html: branding.signatureHtml }}
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => { setEditingSignature(false); setBranding((b) => ({ ...b, signatureHtml: saved.signatureHtml })); }}
              className="text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div
              className="text-sm text-gray-700"
              dangerouslySetInnerHTML={{ __html: signatureToShow }}
            />
            {!branding.signatureHtml && (
              <p className="mt-2 text-[11px] text-gray-400 italic">Default signature</p>
            )}
          </div>
        )}
      </div>

      {/* Save */}
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
