"use client";

import { useState, useTransition } from "react";
import { Bot, Loader2, PhoneOutgoing, Users, CalendarClock } from "lucide-react";
import { callLead } from "@/lib/actions/outbound";

type FollowUpContact = { id: string; name: string; phone: string | null; company: string | null; stage: string };
type ApptContact = { clientId: string; name: string; phone: string | null; startAt: string };
type Purpose = "follow_up" | "appointment_reminder";

const PURPOSES: { key: Purpose; label: string; hint: string; icon: typeof Users }[] = [
  { key: "follow_up", label: "Follow-up", hint: "Re-engage leads & clients", icon: Users },
  { key: "appointment_reminder", label: "Appointment reminder", hint: "Confirm upcoming bookings", icon: CalendarClock },
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
  const [, startTransition] = useTransition();

  function call(clientId: string, name: string, phone: string | null) {
    if (!phone || pendingId) return;
    if (!window.confirm(`Place an AI call to ${name} at ${phone}?\n\nThe AI agent will call them now on your behalf.`)) return;
    setPendingId(clientId);
    setMsg(null);
    startTransition(async () => {
      const res = await callLead({ clientId, purpose });
      setPendingId(null);
      setMsg(res.ok ? { ok: true, text: `📞 Calling ${res.name} now — the AI agent is dialing.` } : { ok: false, text: res.error });
    });
  }

  const rows =
    purpose === "appointment_reminder"
      ? appointments.map((a) => ({ key: `${a.clientId}-${a.startAt}`, id: a.clientId, name: a.name, phone: a.phone, meta: formatWhen(a.startAt) }))
      : followUp.map((c) => ({ key: c.id, id: c.id, name: c.name, phone: c.phone, meta: c.company || "" }));

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
        <PhoneOutgoing className="w-4 h-4 text-indigo-500" />
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Outbound calls</h2>
          <p className="text-xs text-slate-400">The AI agent calls your contacts — distinct from you dialing them yourself.</p>
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

          {msg && (
            <div className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"}`}>
              {msg.text}
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
                    disabled={!r.phone || pendingId !== null}
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
