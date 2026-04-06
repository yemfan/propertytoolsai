"use client";

import { useState } from "react";

type Props = {
  reportLink: string;
  propertyAddress: string | null;
};

export function ShareReportButton({ reportLink, propertyAddress }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function send() {
    if (!email.trim()) return;
    setSending(true);
    setMsg(null);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const fullLink = reportLink.startsWith("http") ? reportLink : `${origin}${reportLink}`;
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email.trim(),
          subject: `Property Report: ${propertyAddress ?? "Your Property"}`,
          text: `Hi,\n\nHere is your property report:\n${fullLink}\n\nIncludes estimated home value, market comparables, and investment insights.\n\nBest regards`,
        }),
      });
      if (res.ok) {
        setMsg("Sent!");
        setEmail("");
        setTimeout(() => { setMsg(null); setOpen(false); }, 2000);
      } else {
        setMsg("Failed to send.");
      }
    } catch {
      setMsg("Network error.");
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
      >
        Share
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@example.com"
        className="w-40 rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-brand-primary"
      />
      <button
        type="button"
        disabled={sending || !email.trim()}
        onClick={() => void send()}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-primary text-white hover:bg-[#005ca8] disabled:opacity-50"
      >
        {sending ? "..." : "Send"}
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); setMsg(null); }}
        className="text-xs text-slate-400 hover:text-slate-600"
      >
        Cancel
      </button>
      {msg && <span className={`text-xs ${msg === "Sent!" ? "text-green-700" : "text-red-600"}`}>{msg}</span>}
    </div>
  );
}
