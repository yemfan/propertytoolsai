"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { describeUserRole, formatUserRoleLabel } from "@leadsmart/shared";
import { uploadProfilePhotoWithSessionClient } from "@/lib/profileAvatarClient";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { formatUsPhoneInput, formatUsPhoneStored, isValidUsPhone } from "@/lib/usPhone";

type Me = {
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  has_agent_record?: boolean;
};

export default function ProfileSettingsForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data: sessionData } = await supabaseBrowser().auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/me", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const json = (await res.json().catch(() => ({}))) as Me & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not load profile");
        return;
      }
      setMe(json);
      setFullName((json.full_name ?? "").trim());
      setPhone(formatUsPhoneInput((json.phone ?? "").trim()));
      setEmail((json.email ?? "").trim());
    } catch {
      setError("Could not load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    const phoneTrim = phone.trim();
    if (phoneTrim && !isValidUsPhone(phone)) {
      setError("Phone must be a valid US number (10 digits).");
      setSaving(false);
      return;
    }
    const phonePayload = phoneTrim ? formatUsPhoneStored(phone) ?? "" : "";
    const emailTrim = email.trim();
    if (!emailTrim) {
      setError("Email is required.");
      setSaving(false);
      return;
    }
    try {
      const { data: sessionData } = await supabaseBrowser().auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ full_name: fullName, phone: phonePayload, email: emailTrim }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Save failed");
        return;
      }
      await supabaseBrowser().auth.refreshSession();
      setSuccess("Profile saved.");
      await load();
      router.refresh();
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const supabase = supabaseBrowser();
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (!refreshed.session) {
        setError("Sign in again to upload a photo.");
        return;
      }
      const result = await uploadProfilePhotoWithSessionClient(supabase, file);
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      setMe((m) => ({ ...m, avatar_url: result.publicUrl }));
      setSuccess("Photo updated.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-600 shadow-sm">
        Loading profile…
      </div>
    );
  }

  const avatarSrc = me?.avatar_url?.trim() || null;
  const initial = (me?.email?.trim()?.[0] || "?").toUpperCase();

  const roleLabel = formatUserRoleLabel(me?.role);
  const roleDescription = describeUserRole(me?.role);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Account type</h2>
        <p className="mt-1 text-sm text-gray-600">
          Your role is stored in <span className="font-medium">leadsmart_users.role</span> and drives which apps and
          menus you can access. It is not editable here.
        </p>
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-sm font-semibold text-gray-900">{roleLabel}</p>
          <p className="mt-1 text-sm text-gray-600 leading-relaxed">{roleDescription}</p>
          {me?.has_agent_record ? (
            <p className="mt-2 text-xs text-gray-500">CRM agent record: linked.</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Profile photo</h2>
        <p className="mt-1 text-sm text-gray-600">JPG, PNG, WebP, or GIF — up to 5 MB.</p>
        <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-100">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- dynamic Supabase Storage URL
              <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-blue-800">
                {initial}
              </div>
            )}
          </div>
          <div>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {uploading ? "Uploading…" : "Upload new photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
                className="hidden"
                onChange={(ev) => void onPickPhoto(ev)}
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      </div>

      <form onSubmit={saveProfile} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoComplete="name"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">Phone</label>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(formatUsPhoneInput(e.target.value))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoComplete="tel"
            placeholder="(555) 555-5555"
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
