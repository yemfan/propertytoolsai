"use client";

import { useCallback, useState } from "react";

/**
 * Click-to-Call button.
 *
 * Drops anywhere we render a contact row (contacts list, lead
 * detail, transaction detail). Click → POST to
 * /api/dashboard/click-to-call → Twilio rings the agent first,
 * bridges to the lead on pickup.
 *
 * Three visual states:
 *   - Idle (phone icon + label OR phone icon only when iconOnly)
 *   - Calling (spinner + "Calling…")
 *   - After-confirmation: shows a small toast banner above the
 *     button explaining "Pick up your phone — we'll connect you to
 *     {{lead}}." for ~3 seconds, then reverts to idle.
 *
 * When the API returns an error, the button surfaces the message
 * inline (and routes user to Settings when no_forwarding_phone
 * fires).
 */
export function ClickToCallButton({
  contactId,
  contactName,
  variant = "default",
  iconOnly = false,
  onSettingsRequest,
}: {
  contactId: string;
  /** Used in the post-call toast: "Pick up your phone — connecting to {{name}}". */
  contactName?: string | null;
  variant?: "default" | "ghost";
  /** Render as just the phone icon (compact list rows). */
  iconOnly?: boolean;
  /** Hook fired on the no_forwarding_phone error so the parent can
   *  open Settings or scroll to it. Optional. */
  onSettingsRequest?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (busy) return;
      setBusy(true);
      setError(null);
      setToast(null);
      try {
        const res = await fetch("/api/dashboard/click-to-call", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ contactId }),
        });
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          message?: string;
          error?: string;
          code?: string;
        } | null;
        if (res.ok && json?.ok) {
          setToast(
            json.message ??
              `Calling your phone — pick up to connect with ${contactName ?? "the lead"}.`,
          );
          window.setTimeout(() => setToast(null), 3500);
          return;
        }
        if (json?.code === "no_forwarding_phone") {
          setError(
            json.error ??
              "Add your mobile in Settings before using click-to-call.",
          );
          onSettingsRequest?.();
          return;
        }
        setError(
          json?.error ??
            `Could not start the call (HTTP ${res.status}).`,
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Network error starting call.",
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, contactId, contactName, onSettingsRequest],
  );

  const baseClass =
    variant === "ghost"
      ? "inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
      : "inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60";

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={baseClass}
        aria-label={`Call ${contactName ?? "contact"}`}
        title={`Call ${contactName ?? "contact"} via click-to-call`}
      >
        {busy ? (
          <SpinnerIcon />
        ) : (
          <PhoneIcon />
        )}
        {iconOnly ? null : busy ? "Calling…" : "Call"}
      </button>
      {toast ? (
        <span className="mt-1 max-w-xs rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
          {toast}
        </span>
      ) : null}
      {error ? (
        <span className="mt-1 max-w-xs rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-800 ring-1 ring-inset ring-red-200">
          {error}
        </span>
      ) : null}
    </span>
  );
}

function PhoneIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="animate-spin"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
