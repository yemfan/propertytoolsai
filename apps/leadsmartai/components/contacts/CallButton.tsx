"use client";

import { useState } from "react";

/**
 * Click-to-call button rendered next to the contact's phone number.
 *
 * On click, POSTs to /api/voice/click-to-call. Twilio bridges the
 * agent's phone to the contact's. The button shows a one-second
 * "Calling…" state while awaiting the API response, then either
 * "Ringing your phone" on success or a structured error code's
 * copy on failure.
 *
 * Errors are intentionally specific (no generic "something went
 * wrong") so the agent knows whether to update Settings, the
 * contact's phone, or wait for ops to wire Twilio.
 */
export function CallButton({
  contactId,
  hasPhone,
}: {
  contactId: string;
  hasPhone: boolean;
}) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "calling" }
    | { kind: "ringing" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  if (!hasPhone) return null;

  const onClick = async () => {
    setState({ kind: "calling" });
    try {
      const res = await fetch("/api/voice/click-to-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        code?: string;
      };
      if (res.ok && json.ok) {
        setState({ kind: "ringing" });
        // Reset back to idle after a few seconds so the button can be reused.
        setTimeout(() => setState({ kind: "idle" }), 4000);
      } else {
        setState({
          kind: "error",
          message: friendlyError(json.code, json.error),
        });
        setTimeout(() => setState({ kind: "idle" }), 6000);
      }
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message });
      setTimeout(() => setState({ kind: "idle" }), 6000);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state.kind === "calling" || state.kind === "ringing"}
      className={[
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition",
        state.kind === "ringing"
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : state.kind === "error"
            ? "bg-red-50 text-red-700 ring-1 ring-red-200"
            : "bg-blue-50 text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100 disabled:opacity-60",
      ].join(" ")}
      title={state.kind === "error" ? state.message : "Bridge your phone to this contact"}
      aria-label="Call contact"
    >
      <PhoneIcon />
      {state.kind === "idle" && "Call"}
      {state.kind === "calling" && "Calling…"}
      {state.kind === "ringing" && "Ringing your phone"}
      {state.kind === "error" && "Failed"}
    </button>
  );
}

function PhoneIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function friendlyError(code: string | undefined, fallback: string | undefined): string {
  switch (code) {
    case "missing_agent_phone":
      return "Add your phone number under Settings before placing calls.";
    case "missing_contact_phone":
      return "This contact has no phone number on file.";
    case "invalid_phone":
      return "The phone number isn't in a valid format.";
    case "missing_caller_id":
    case "twilio_not_configured":
      return "Calling isn't configured yet — contact your admin.";
    case "twilio_api_failed":
      return "Twilio rejected the call.";
    default:
      return fallback ?? "Call could not be placed.";
  }
}
