"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Client-side bits of the connect page:
 *   - One-shot flash message reading `?status=…&reason=…&count=…`
 *     from the OAuth callback. Dismisses on close OR after we've
 *     read it once into local state.
 *   - "Connect Facebook" link that just hits the start route.
 *   - Per-connection Disconnect button with a confirm prompt.
 *
 * The list of connections is server-rendered above by the page —
 * after a disconnect we router.refresh() to re-fetch.
 */

type ConnectedAccountRow = {
  id: string;
  fb_page_id: string | null;
  fb_page_name: string | null;
  ig_business_user_id: string | null;
  ig_business_username: string | null;
  account_picture_url: string | null;
  status: string;
  last_error: string | null;
  user_token_expires_at: string | null;
  connected_at: string;
};

type Flash =
  | { kind: "success"; title: string; body: string }
  | { kind: "cancelled"; title: string; body: string }
  | { kind: "error"; title: string; body: string };

function buildFlash(
  status: string | null,
  reason: string | null,
  count: string | null,
): Flash | null {
  if (!status) return null;
  if (status === "success") {
    const n = Number(count) || 1;
    return {
      kind: "success",
      title: "Facebook connected",
      body: `Linked ${n} ${n === 1 ? "Page" : "Pages"}. You can now publish posts directly from the Quick Post wizard.`,
    };
  }
  if (status === "cancelled") {
    return {
      kind: "cancelled",
      title: "Connection cancelled",
      body: reason
        ? `You exited the Facebook dialog before granting access (${reason}).`
        : "You exited the Facebook dialog before granting access.",
    };
  }
  return {
    kind: "error",
    title: "Connection failed",
    body: reason ?? "Something went wrong during the Facebook connection.",
  };
}

export default function ConnectClient({
  initialStatus,
  initialReason,
  initialCount,
  connections,
}: {
  initialStatus: string | null;
  initialReason: string | null;
  initialCount: string | null;
  connections: ConnectedAccountRow[];
}) {
  const router = useRouter();
  const [flash, setFlash] = useState<Flash | null>(() =>
    buildFlash(initialStatus, initialReason, initialCount),
  );
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Strip status/reason/count from the URL after first render so a
  // refresh doesn't re-show the flash. We do this client-side to
  // avoid a server round-trip.
  useEffect(() => {
    if (!initialStatus) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("status");
    url.searchParams.delete("reason");
    url.searchParams.delete("count");
    window.history.replaceState(null, "", url.toString());
  }, [initialStatus]);

  const onDisconnect = useCallback(
    async (id: string, label: string) => {
      if (!confirm(`Disconnect ${label}? Posts already published will stay live on Facebook.`)) return;
      setActionError(null);
      setDisconnectingId(id);
      try {
        const res = await fetch("/api/leads-gen/connect/meta/disconnect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!res.ok || !body.ok) throw new Error(body.error ?? "Disconnect failed");
        // Refresh so the server-rendered list updates.
        router.refresh();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Disconnect failed");
      } finally {
        setDisconnectingId(null);
      }
    },
    [router],
  );

  return (
    <div className="space-y-5">
      {flash && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm flex items-start justify-between gap-3 ${
            flash.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : flash.kind === "cancelled"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          <div>
            <p className="font-semibold">{flash.title}</p>
            <p className="mt-0.5">{flash.body}</p>
          </div>
          <button
            type="button"
            onClick={() => setFlash(null)}
            aria-label="Dismiss"
            className="text-xs opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {actionError}
        </div>
      )}

      {/* Meta card */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-2xl">
              📘
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Facebook &amp; Instagram
              </h2>
              <p className="text-sm text-gray-600">
                Connect a Facebook Page. If it&apos;s linked to an Instagram
                Business account, that&apos;s connected automatically — one
                grant covers both.
              </p>
            </div>
          </div>
          <a
            href="/api/leads-gen/connect/meta/start"
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {connections.length > 0 ? "Connect another" : "Connect Facebook"}
          </a>
        </div>

        {connections.length > 0 ? (
          <ul className="mt-5 space-y-2">
            {connections.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50/40 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {c.account_picture_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.account_picture_url}
                      alt={c.fb_page_name ?? ""}
                      className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-gray-200"
                    />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                      {(c.fb_page_name ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {c.fb_page_name ?? "Facebook Page"}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {c.ig_business_username ? (
                        <>
                          <span className="rounded-full bg-pink-100 px-1.5 py-0.5 font-medium text-pink-700">
                            IG @{c.ig_business_username}
                          </span>{" "}
                          ·{" "}
                        </>
                      ) : null}
                      Page ID {c.fb_page_id}
                      {c.user_token_expires_at && (
                        <>
                          {" · "}
                          Token expires{" "}
                          {new Date(c.user_token_expires_at).toLocaleDateString()}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {c.status !== "connected" && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                      {c.status}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onDisconnect(c.id, c.fb_page_name ?? "this Page")}
                    disabled={disconnectingId === c.id}
                    className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-white disabled:opacity-50"
                  >
                    {disconnectingId === c.id ? "Disconnecting…" : "Disconnect"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50/60 px-3 py-3 text-sm text-gray-500">
            No Pages connected yet. Connect one to start publishing.
          </p>
        )}

        <p className="mt-4 text-xs text-gray-400">
          Granted scopes are stored encrypted; disconnect any time. To fully
          revoke the OAuth grant from Facebook&apos;s side too, visit your
          Facebook account&apos;s <em>Apps and Websites</em> and remove
          LeadSmart AI.
        </p>
      </section>

      {/* Phase 3 placeholders */}
      <section className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/40 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-2xl">
            💼
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-700">
              LinkedIn{" "}
              <span className="ml-1 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                Phase 3
              </span>
            </h2>
            <p className="text-sm text-gray-500">
              LinkedIn personal + Company Page posting coming after Meta launch.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/40 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-2xl">
            🔍
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-700">
              Google Ads{" "}
              <span className="ml-1 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                Phase 3
              </span>
            </h2>
            <p className="text-sm text-gray-500">
              Search + Performance Max campaigns from inside Generate Leads.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
