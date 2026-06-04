"use client";

import { useState } from "react";

type Slot = { startISO: string; label: string };

export function RescheduleSlots({ token, slots }: { token: string; slots: Slot[] }) {
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [confirmed, setConfirmed] = useState("");
  const [error, setError] = useState("");

  async function pick(slot: Slot) {
    setStatus("saving");
    setError("");
    try {
      const res = await fetch(`/api/reschedule/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: slot.startISO }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; label?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "That time isn't available anymore — please pick another.");
        setStatus("error");
        return;
      }
      setConfirmed(data.label || slot.label);
      setStatus("done");
    } catch {
      setError("Something went wrong — please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 12, padding: "20px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: "#047857", margin: "0 0 4px" }}>You&apos;re rescheduled ✓</p>
        <p style={{ fontSize: 14, color: "#065f46", margin: 0 }}>New time: {confirmed}. We&apos;ve sent you a confirmation.</p>
      </div>
    );
  }

  return (
    <div>
      {status === "error" && (
        <p style={{ fontSize: 13, color: "#f43f5e", margin: "0 0 12px" }}>{error}</p>
      )}
      {slots.length === 0 ? (
        <p style={{ fontSize: 14, color: "#94a3b8" }}>No open times that day — try another day above.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
          {slots.map((s) => (
            <button
              key={s.startISO}
              disabled={status === "saving"}
              onClick={() => pick(s)}
              style={{
                padding: "12px 10px",
                background: "#fff",
                border: "1px solid #d2e8fb",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                color: "#1e88e5",
                cursor: status === "saving" ? "default" : "pointer",
                opacity: status === "saving" ? 0.6 : 1,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
