"use client";

import { useState, useTransition } from "react";
import { Bot, Loader2, PhoneOutgoing, Users, CalendarClock, ClipboardList, Megaphone } from "lucide-react";
import { callLead, callAll } from "@/lib/actions/outbound";

type FollowUpContact = { id: string; name: string; phone: string | null; company: string | null; stage: string };
type ApptContact = { clientId: string; name: string; phone: string | null; startAt: string };
type Purpose = "follow_up" | "appointment_reminder" | "survey" | "promo";

const PURPOSES: { key: Purpose; label: string; hint: string; icon: typeof Users }[] = [
  { key: "follow_up", label: "Follow-up", hint: "Re-engage leads & clients", icon: Users },
  { key: "appointment_reminder", label: "Appointment reminder", hint: "Confirm upcoming bookings", icon: CalendarClock },
  { key: "survey", label: "Survey / review", hint: "Ask for feedback or a review", icon: ClipboardList },
  { key: "promo", label: "Promo / announcement", hint: "Share news or an offer", icon: Megaphone },
];

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function OutboundCalls({
  followUp,
  appointments,
  hasNumber,
}: {
  followUp: FollowUpContact[];
  appointments: ApptContact[];
  hasNumber: boolean;
}) {
  const [purpose, setPurpose] = useState<Purpose>("follow_up");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [detail, setDetail] = useState("");
  const [, startTransition] = useTransition();

  const needsDetail = purpose === "survey" || purpose === "promo";
  const detailMissing = needsDetail && !detail.trim();

  function call(clientId: string, name: string, phone: string | null) {
    if (!phone || pendingId) return;
    if (detailMissing) {
      setMsg({ ok: false, text: purpose === "survey" ? "Add the survey questions first." : "Add the announcement message first." });
      return;
    }
    if (!window.confirm(`Place an AI call to ${name} at ${phone}?\n\nThe AI agent will call them now on your behalf.`)) return;
    setPendingId(clientId);
    setMsg(null);
    startTransition(async () => {
      const res = await callLead({ clientId, purpose, detail: needsDetail ? detail.trim() : undefined });
      setPendingId(null);
      setMsg(res.ok ? { ok: true, text: `📞 Calling ${res.name} now — the AI agent is dialing.` } : { ok: false, text: res.error });
    });
  }

  const rows =
    purpose === "appointment_reminder"
      ? appointments.map((a) => ({ key: `${a.clientId}-${a.startAt}`, id: a.clientId, name: a.name, phone: a.phone, meta: formatWhen(a.startAt) }))
      : followUp.map((c) => ({ key: c.id, id: c.id, name: c.name, phone: c.phone, meta: c.company || "" }));

  function callEveryone() {
    const ids = Array.from(new Set(rows.map((r) => r.id)));
    if (!ids.length || bulkPending || pendingId) return;
    if (detailMissing) {
      setMsg({ ok: false, text: purpose === "survey" ? "Add the survey questions first." : "Add the announcement message first." });
      return;
    }
    const n = Math.min(ids.length, 15);
    if (!window.confirm(`Place AI calls to ${n} contact${n !== 1 ? "s" : ""}?\n\nThey'll be dialed in the background — staggered and only within calling hours.`)) return;
    setBulkPending(true);
    setMsg(null);
    startTransition(async () => {
      const res = await callAll({ purpose, clientIds: ids, detail: needsDetail ? detail.trim() : undefined });
      setBulkPending(false);
      setMsg(
        res.ok
          ? { ok: true, text: `📞 Queued ${res.queued} call${res.queued !== 1 ? "s" : ""} — dialing now, staggered and within calling hours.` }
          : { ok: false, text: res.error }
      );
    });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
        <PhoneOutgoing className="w-4 h-4 text-indigo-500" />
        <div>
          <h2 className="text-sm font-semibold text-slate-700">AI Concierge</h2>
          <p className="text-xs text-slate-400">Your AI calls your contacts on your behalf — distinct from you dialing them yourself.</p>
        </div>
      </div>

      {!hasNumber ? (
        <div className="px-6 py-8 text-center text-sm text-slate-500">
          Connect a phone number in{" "}
          <a href="/settings#voice-agent" className="text-indigo-600 hover:underline">Settings → AI Voice agent</a>{" "}
          to place outbound calls.
        </div>
      ) : (
        <div className="p-6 space-y-4">
          {/* Purpose picker */}
          <div className="flex flex-wrap gap-2">
            {PURPOSES.map(({ key, label, hint, icon: Icon }) => (
              <button
                key={key}
                onClick={() => { setPurpose(key); setMsg(null); }}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  purpose === key ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
                title={hint}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Message / questions for survey + promo calls */}
          {needsDetail && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                {purpose === "survey" ? "What should the AI ask?" : "What's the announcement?"}
              </label>
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                rows={2}
                placeholder={
                  purpose === "survey"
                    ? 'e.g. "How was your recent service, 1–5? Would you leave us a Google review?"'
                    : 'e.g. "We\'re running 15% off new bookings through Friday — want me to book you in?"'
                }
                className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                The AI works this into a short, friendly call and adapts to each contact.
              </p>
            </div>
          )}

          {msg && (
            <div className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"}`}>
              {msg.text}
            </div>
          )}

          {/* Call all */}
          {rows.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{rows.length} contact{rows.length !== 1 ? "s" : ""}</span>
              <button
                onClick={callEveryone}
                disabled={bulkPending || pendingId !== null}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
              >
                {bulkPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PhoneOutgoing className="w-3.5 h-3.5" />}
                Call all{rows.length > 15 ? " (first 15)" : ` (${rows.length})`}
              </button>
            </div>
          )}

          {/* Contact list */}
          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              {purpose === "appointment_reminder"
                ? "No upcoming appointments with a phone number."
                : "No contacts with a phone number yet."}
            </div>
          ) : (
            <div className="divide-y divide-slate-50 border border-slate-100 rounded-lg overflow-hidden">
              {rows.map((r) => (
                <div key={r.key} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{r.name || "Unnamed"}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {r.phone || "no phone"}{r.meta ? ` · ${r.meta}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => call(r.id, r.name || "this contact", r.phone)}
                    disabled={!r.phone || pendingId !== null || bulkPending}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
                  >
                    {pendingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                    AI Call
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            Calls disclose they&apos;re AI and only dial 8am–9pm local time.
          </p>
        </div>
      )}
    </div>
  );
}
