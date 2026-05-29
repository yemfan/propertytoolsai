"use client";

import { useState, useTransition } from "react";
import { Clock, CalendarClock, BookOpen, Plus, Trash2, Check, CalendarCheck } from "lucide-react";
import {
  saveBusinessHours,
  upsertAppointmentType,
  deleteAppointmentType,
  upsertKnowledgeEntry,
  deleteKnowledgeEntry,
  disconnectGoogleCalendar,
} from "@/lib/actions/receptionist";
import {
  DAY_KEYS,
  DAY_LABELS,
  type BusinessHours,
  type AppointmentType,
  type KnowledgeEntry,
} from "@/lib/receptionist";

interface Props {
  hours: BusinessHours;
  appointmentTypes: AppointmentType[];
  knowledge: KnowledgeEntry[];
  googleConfigured: boolean;
  googleConnected: boolean;
  googleEmail: string | null;
}

export function ReceptionistConfig({ hours, appointmentTypes, knowledge, googleConfigured, googleConnected, googleEmail }: Props) {
  return (
    <div className="space-y-6">
      <CalendarConnectCard configured={googleConfigured} connected={googleConnected} email={googleEmail} />
      <BusinessHoursCard initial={hours} />
      <AppointmentTypesCard initial={appointmentTypes} />
      <KnowledgeCard initial={knowledge} />
    </div>
  );
}

// ─── Google Calendar connect ────────────────────────────────────────────────────

function CalendarConnectCard({ configured, connected, email }: { configured: boolean; connected: boolean; email: string | null }) {
  const [isConnected, setConnected] = useState(connected);
  const [pending, start] = useTransition();

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-1">
        <CalendarCheck className="w-4 h-4 text-indigo-500" />
        <h2 className="text-sm font-semibold text-slate-800">Calendar</h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Connect Google Calendar so the receptionist books into your real calendar and only offers times you&apos;re actually free.
      </p>
      {!configured ? (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          Google Calendar isn&apos;t configured on the server yet. Until it is, bookings use smbai&apos;s built-in calendar.
        </p>
      ) : isConnected ? (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5">
            <CalendarCheck className="w-3.5 h-3.5" /> Connected{email ? ` · ${email}` : ""}
          </span>
          <button
            onClick={() => start(async () => { const r = await disconnectGoogleCalendar(); if (!r.error) setConnected(false); })}
            disabled={pending}
            className="text-xs font-medium text-slate-500 hover:text-rose-600 disabled:opacity-50"
          >
            {pending ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      ) : (
        <a
          href="/api/auth/google-calendar"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <CalendarCheck className="w-4 h-4" /> Connect Google Calendar
        </a>
      )}
    </div>
  );
}

// ─── Business hours ─────────────────────────────────────────────────────────────

function BusinessHoursCard({ initial }: { initial: BusinessHours }) {
  const [hours, setHours] = useState<BusinessHours>(initial);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-indigo-500" />
        <h2 className="text-sm font-semibold text-slate-800">Business hours</h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">The receptionist only books inside these hours.</p>
      <div className="space-y-2">
        {DAY_KEYS.map((day) => {
          const h = hours[day];
          const closed = h === null;
          return (
            <div key={day} className="flex items-center gap-3">
              <span className="w-24 text-sm text-slate-600">{DAY_LABELS[day]}</span>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 w-16">
                <input
                  type="checkbox"
                  checked={!closed}
                  onChange={(e) =>
                    setHours((prev) => ({ ...prev, [day]: e.target.checked ? { open: "09:00", close: "17:00" } : null }))
                  }
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                {closed ? "Closed" : "Open"}
              </label>
              {!closed && (
                <>
                  <input
                    type="time"
                    value={h.open}
                    onChange={(e) =>
                      setHours((prev) => ({ ...prev, [day]: { open: e.target.value, close: (prev[day] as { close: string }).close } }))
                    }
                    className="border border-slate-200 rounded-lg px-2 py-1 text-sm"
                  />
                  <span className="text-slate-400 text-sm">to</span>
                  <input
                    type="time"
                    value={h.close}
                    onChange={(e) =>
                      setHours((prev) => ({ ...prev, [day]: { open: (prev[day] as { open: string }).open, close: e.target.value } }))
                    }
                    className="border border-slate-200 rounded-lg px-2 py-1 text-sm"
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
      <button
        onClick={() => start(async () => { await saveBusinessHours(hours); setSaved(true); setTimeout(() => setSaved(false), 2000); })}
        disabled={pending}
        className="mt-4 flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {saved && <Check className="w-4 h-4" />}
        {pending ? "Saving…" : saved ? "Saved" : "Save hours"}
      </button>
    </div>
  );
}

// ─── Appointment types ──────────────────────────────────────────────────────────

function AppointmentTypesCard({ initial }: { initial: AppointmentType[] }) {
  const [types, setTypes] = useState(initial);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(30);
  const [pending, start] = useTransition();

  function add() {
    if (!name.trim()) return;
    start(async () => {
      const res = await upsertAppointmentType({ name, durationMinutes: duration });
      if (res.id) {
        setTypes((t) => [...t, { id: res.id!, name: name.trim(), duration_minutes: duration, description: null, active: true, sort: 0 }]);
        setName("");
        setDuration(30);
      }
    });
  }

  function remove(id: string) {
    start(async () => {
      await deleteAppointmentType(id);
      setTypes((t) => t.filter((x) => x.id !== id));
    });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-1">
        <CalendarClock className="w-4 h-4 text-indigo-500" />
        <h2 className="text-sm font-semibold text-slate-800">Appointment types</h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">What the receptionist can book — each with a duration so the calendar slot is right.</p>
      <div className="space-y-2 mb-4">
        {types.length === 0 && <p className="text-xs text-slate-400">No appointment types yet.</p>}
        {types.map((t) => (
          <div key={t.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2">
            <span className="flex-1 text-sm text-slate-700">{t.name}</span>
            <span className="text-xs text-slate-500">{t.duration_minutes} min</span>
            <button onClick={() => remove(t.id)} disabled={pending} className="text-slate-400 hover:text-rose-600 disabled:opacity-50">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Consultation"
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="number"
          value={duration}
          min={5}
          max={480}
          step={5}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-20 border border-slate-200 rounded-lg px-2 py-2 text-sm"
        />
        <span className="text-xs text-slate-400">min</span>
        <button
          onClick={add}
          disabled={pending || !name.trim()}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
    </div>
  );
}

// ─── Knowledge base ─────────────────────────────────────────────────────────────

function KnowledgeCard({ initial }: { initial: KnowledgeEntry[] }) {
  const [entries, setEntries] = useState(initial);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pending, start] = useTransition();

  function add() {
    if (!title.trim() || !content.trim()) return;
    start(async () => {
      const res = await upsertKnowledgeEntry({ title, content });
      if (res.id) {
        setEntries((e) => [...e, { id: res.id!, title: title.trim(), content: content.trim(), active: true, sort: 0 }]);
        setTitle("");
        setContent("");
      }
    });
  }

  function remove(id: string) {
    start(async () => {
      await deleteKnowledgeEntry(id);
      setEntries((e) => e.filter((x) => x.id !== id));
    });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-1">
        <BookOpen className="w-4 h-4 text-indigo-500" />
        <h2 className="text-sm font-semibold text-slate-800">Knowledge base</h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Products, services, pricing, policies, FAQs — what the receptionist answers from. If it isn&apos;t here, the agent takes a message instead of guessing.
      </p>
      <div className="space-y-2 mb-4">
        {entries.length === 0 && <p className="text-xs text-slate-400">No knowledge entries yet.</p>}
        {entries.map((e) => (
          <div key={e.id} className="bg-slate-50 rounded-lg px-3 py-2 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700">{e.title}</p>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 whitespace-pre-wrap">{e.content}</p>
            </div>
            <button onClick={() => remove(e.id)} disabled={pending} className="text-slate-400 hover:text-rose-600 disabled:opacity-50 flex-shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Topic (e.g. Pricing, Services, Parking)"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          placeholder="What should the receptionist know about this?"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
        <button
          onClick={add}
          disabled={pending || !title.trim() || !content.trim()}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
        >
          <Plus className="w-3.5 h-3.5" /> Add entry
        </button>
      </div>
    </div>
  );
}
