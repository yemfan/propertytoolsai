"use client";

import { useState } from "react";
import { PhoneOutgoing } from "lucide-react";

/**
 * Outbound AI calling. The AI receptionist (Lucy) dials a lead from your
 * receptionist number, discloses it's an AI, and follows up. Mirrors the
 * HelmSmart outbound console.
 */
export default function OutboundCallPanel() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "calling" | "placed" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function placeCall() {
    if (!phone.trim() || status === "calling") return;
    setStatus("calling");
    setMessage(null);
    try {
      const res = await fetch("/api/dashboard/voice/outbound-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; to?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to place the call.");
      setStatus("placed");
      setMessage(`Calling ${data.to}… Lucy will dial now and follow up.`);
      setPhone("");
      setName("");
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Failed to place the call.");
    }
  }

  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">AI outbound call</h2>
        <p className="mt-0.5 mb-4 text-xs text-slate-500">
          Lucy dials the lead from your receptionist number, opens by disclosing she&apos;s an AI
          assistant, and follows up on your behalf — then logs the call below in Inbound &amp; outbound activity.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-[11px] font-medium text-slate-500">Lead name (optional)</span>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hong Yang" />
          </div>
          <div>
            <span className="mb-1 block text-[11px] font-medium text-slate-500">Phone number</span>
            <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (626) 555-1234" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void placeCall()}
            disabled={!phone.trim() || status === "calling"}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            <PhoneOutgoing className="h-4 w-4" strokeWidth={2} />
            {status === "calling" ? "Placing call…" : "AI Call"}
          </button>
          {message && (
            <span className={`text-xs font-medium ${status === "error" ? "text-rose-600" : "text-emerald-600"}`}>
              {message}
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Outbound calls go out from your receptionist number and require Retell calling credits.
        Coming next: call a CRM contact in one click + bulk &ldquo;call all.&rdquo;
      </p>
    </div>
  );
}
