"use client";

import { useCallback, useEffect, useState } from "react";

type Status = {
  configured: boolean;
  connected: boolean;
  accountEmail: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  syncEnabled: boolean;
  messagesSynced: number;
};

/**
 * Connect / disconnect + live status for Gmail 2-way sync.
 *
 * Shows:
 *   - "Not configured" banner if the server has no OAuth creds
 *   - A prominent "Connect Gmail" button if not yet connected
 *   - Connected state: account email, last-sync time, running count
 *     of messages logged, last error (if any), disconnect button
 *
 * Picks up `?gmail_connected=1` / `?gmail_error=...` from the
 * callback redirect and shows a toast-ish confirmation at the top.
 */
export function GmailSyncCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [flash, setFlash] = useState<{ tone: "ok" | "err"; text: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/integrations/gmail-status");
      const body = (await res.json().catch(() => null)) as
        | ({ ok: true } & Status)
        | null;
      if (body?.ok) setStatus(body);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    // Absorb the callback redirect params into a toast, then strip
    // them from the URL so a refresh doesn't replay the message.
    try {
      const url = new URL(window.location.href);
      const connected = url.searchParams.get("gmail_connected");
      const err = url.searchParams.get("gmail_error");
      if (connected) setFlash({ tone: "ok", text: "Gmail connected ✓" });
      else if (err)
        setFlash({
          tone: "err",
          text: `Gmail connect failed: ${err}`,
        });
      if (connected || err) {
        url.searchParams.delete("gmail_connected");
        url.searchParams.delete("gmail_error");
        window.history.replaceState({}, "", url.pathname + url.search);
      }
    } catch {
      /* no-op */
    }
  }, [load]);

  async function onDisconnect() {
    if (!confirm("Disconnect Gmail? Your already-synced messages stay in the CRM.")) {
      return;
    }
    setDisconnecting(true);
    try {
      await fetch("/api/auth/google-gmail/disconnect", { method: "POST" });
      setFlash({ tone: "ok", text: "Gmail disconnected." });
      await load();
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading || !status) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Gmail sync</h2>
        <p className="mt-2 text-xs text-gray-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Gmail sync</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Automatically log emails between you and your contacts. Read-only
            for now — sending from LeadSmart still uses your CRM mailer.
          </p>
        </div>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-lg">
          ✉️
        </span>
      </div>

      {flash ? (
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
            flash.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {flash.text}
        </div>
      ) : null}

      {!status.configured ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Gmail sync isn&apos;t configured on this environment. Ask your admin
          to set <code className="font-mono">GOOGLE_GMAIL_CLIENT_ID</code> +{" "}
          <code className="font-mono">GOOGLE_GMAIL_CLIENT_SECRET</code>.
        </div>
      ) : status.connected ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Connected
                </div>
                <div className="mt-0.5 text-sm font-medium text-emerald-900">
                  {status.accountEmail ?? "(email unknown)"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void onDisconnect()}
                disabled={disconnecting}
                className="rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Last synced
              </div>
              <div className="mt-0.5 text-slate-900">
                {formatRelative(status.lastSyncedAt)}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Messages logged
              </div>
              <div className="mt-0.5 text-slate-900">
                {status.messagesSynced.toLocaleString()}
              </div>
            </div>
          </div>
          {status.lastError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              Last sync error: {status.lastError}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4">
          <a
            href="/api/auth/google-gmail"
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4.236L12 13 4 8.236V6l8 4.764L20 6v2.236z" />
            </svg>
            Connect Gmail
          </a>
          <p className="mt-2 text-[11px] text-gray-500">
            You&apos;ll be redirected to Google to approve read access. We
            never read messages from domains outside your CRM contacts.
          </p>
        </div>
      )}
    </div>
  );
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString();
}
