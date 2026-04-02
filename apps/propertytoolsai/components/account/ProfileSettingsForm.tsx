"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { describeUserRole, formatUserRoleLabel } from "@leadsmart/shared";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

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

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data: sessionData } = await supabaseBrowser().auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/me", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const json = (await res.json().catch(() => ({}))) as Me & { error?: string; plan?: string };
      if (!res.ok && json.error) {
        setError(json.error ?? "Could not load profile");
        return;
      }
      if (json.plan === "guest") {
        setError("Sign in to view your profile.");
        return;
      }
      setMe(json);
      setFullName((json.full_name ?? "").trim());
      setPhone((json.phone ?? "").trim());
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
        body: JSON.stringify({ full_name: fullName, phone }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Save failed");
        return;
      }
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
      const { data: sessionData } = await supabaseBrowser().auth.getSession();
      let token = sessionData.session?.access_token;
      if (!token) {
        const { data: refreshed } = await supabaseBrowser().auth.refreshSession();
        token = refreshed.session?.access_token ?? undefined;
      }
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/me/avatar", {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        hint?: string;
        avatar_url?: string;
      };
      if (!res.ok || !json.ok) {
        setError([json.error, json.hint].filter(Boolean).join(" "));
        return;
      }
      setMe((m) => ({ ...m, avatar_url: json.avatar_url ?? m?.avatar_url }));
      setSuccess("Photo updated.");
      router.refresh();
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
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
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Account type</h2>
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">{roleLabel}</p>
          <p className="mt-1 text-sm text-slate-600 leading-relaxed">{roleDescription}</p>
          {me?.has_agent_record ? (
            <p className="mt-2 text-xs text-slate-500">CRM agent record: linked.</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Profile photo</h2>
        <p className="mt-1 text-sm text-slate-600">JPG, PNG, WebP, or GIF — up to 5 MB.</p>
        <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL
              <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-slate-800">
                {initial}
              </div>
            )}
          </div>
          <div>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-[#0066b3] px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60">
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

      <form onSubmit={saveProfile} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-700">Email</label>
          <input
            type="email"
            value={me?.email ?? ""}
            readOnly
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          />
          <p className="text-[11px] text-slate-500">Email is managed by your login provider.</p>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-700">Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066b3]/30"
            autoComplete="name"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-700">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066b3]/30"
            autoComplete="tel"
            placeholder="(555) 555-5555"
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[#0066b3] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
