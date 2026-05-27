"use client";

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Check, Trash2, ChevronDown } from "lucide-react";
import { createEvent, toggleEventComplete, deleteEvent } from "@/lib/actions/events";

type EventType = "appointment" | "task" | "meeting" | "reminder";
type EventColor = "indigo" | "emerald" | "rose" | "amber" | "slate";

interface CalEvent {
  id: string;
  title: string;
  type: EventType;
  color: EventColor;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  completed: boolean;
  client_id: string | null;
  clients: { first_name: string | null; last_name: string | null } | null;
}

interface Client {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

const COLOR_CLASSES: Record<EventColor, string> = {
  indigo:  "bg-indigo-100 text-indigo-800 border-l-2 border-indigo-500",
  emerald: "bg-emerald-100 text-emerald-800 border-l-2 border-emerald-500",
  rose:    "bg-rose-100 text-rose-800 border-l-2 border-rose-500",
  amber:   "bg-amber-100 text-amber-800 border-l-2 border-amber-500",
  slate:   "bg-slate-100 text-slate-700 border-l-2 border-slate-400",
};

const TYPE_LABELS: Record<EventType, string> = {
  appointment: "Appointment",
  task:        "Task",
  meeting:     "Meeting",
  reminder:    "Reminder",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarGrid({ events, clients }: { events: CalEvent[]; clients: Client[] }) {
  const now  = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [creating, setCreating] = useState<string | null>(null); // ISO date string
  const [form, setForm] = useState({ title: "", type: "appointment" as EventType, color: "indigo" as EventColor, time: "09:00", duration: 60, allDay: false, clientId: "", description: "" });
  const [isPending, startTransition] = useTransition();
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);

  // Grid helpers
  const firstDay  = new Date(year, month, 1);
  const lastDay   = new Date(year, month + 1, 0);
  const startPad  = firstDay.getDay(); // 0=Sun
  const totalCells = startPad + lastDay.getDate();
  const rows = Math.ceil(totalCells / 7);

  function navigate(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setMonth(m); setYear(y);
  }

  function eventsForDay(day: number) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter((e) => e.start_at.startsWith(iso));
  }

  function handleCreate(day: number) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setCreating(iso);
    setForm({ title: "", type: "appointment", color: "indigo", time: "09:00", duration: 60, allDay: false, clientId: "", description: "" });
  }

  function submitCreate() {
    if (!form.title.trim() || !creating) return;
    const startAt = form.allDay
      ? `${creating}T00:00:00`
      : `${creating}T${form.time}:00`;
    const endAt = form.allDay
      ? null
      : (() => {
          const [h, m] = form.time.split(":").map(Number);
          const end = new Date(0);
          end.setHours(h, m + form.duration);
          return `${creating}T${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}:00`;
        })();

    startTransition(async () => {
      await createEvent({
        title: form.title,
        type: form.type,
        color: form.color,
        startAt,
        endAt: endAt ?? undefined,
        allDay: form.allDay,
        clientId: form.clientId || null,
        description: form.description || undefined,
      });
      setCreating(null);
    });
  }

  const monthName = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="flex h-full flex-col">
      {/* Calendar header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{monthName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Today
          </button>
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => navigate(1)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {DAYS.map((d) => (
          <div key={d} className="py-2.5 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 grid grid-cols-7 overflow-auto bg-white"
           style={{ gridTemplateRows: `repeat(${rows}, minmax(120px, 1fr))` }}>
        {Array.from({ length: rows * 7 }, (_, i) => {
          const day = i - startPad + 1;
          const isValid = day >= 1 && day <= lastDay.getDate();
          const isToday = isValid && year === now.getFullYear() && month === now.getMonth() && day === now.getDate();
          const dayEvents = isValid ? eventsForDay(day) : [];

          return (
            <div
              key={i}
              className={`border-b border-r border-slate-100 p-2 min-h-0 flex flex-col group ${!isValid ? "bg-slate-50/50" : "hover:bg-slate-50/50"}`}
            >
              {isValid && (
                <>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? "bg-indigo-600 text-white" : "text-slate-500"
                    }`}>
                      {day}
                    </span>
                    <button
                      onClick={() => handleCreate(day)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-0.5 flex-1 overflow-hidden">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => setSelectedEvent(ev)}
                        className={`w-full text-left px-1.5 py-0.5 rounded text-xs truncate ${COLOR_CLASSES[ev.color]} ${ev.completed ? "opacity-50 line-through" : ""}`}
                      >
                        {!ev.all_day && (
                          <span className="opacity-70 mr-1">
                            {new Date(ev.start_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </span>
                        )}
                        {ev.title}
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <button
                        onClick={() => setSelectedEvent(dayEvents[3])}
                        className="w-full text-left text-xs text-slate-400 px-1.5 hover:text-slate-600"
                      >
                        +{dayEvents.length - 3} more
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Create event modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800">
                New event · {new Date(creating + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </h2>
              <button onClick={() => setCreating(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <input
                type="text"
                autoFocus
                placeholder="Event title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && submitCreate()}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                  <div className="relative">
                    <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as EventType }))}
                      className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-8">
                      {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Color</label>
                  <div className="flex gap-2 mt-1.5">
                    {(Object.keys(COLOR_CLASSES) as EventColor[]).map((c) => (
                      <button
                        key={c}
                        onClick={() => setForm((f) => ({ ...f, color: c }))}
                        className={`w-5 h-5 rounded-full border-2 transition-all ${
                          form.color === c ? "border-slate-800 scale-110" : "border-transparent"
                        } bg-${c}-400`}
                        style={{ backgroundColor: { indigo: "#818cf8", emerald: "#34d399", rose: "#fb7185", amber: "#fbbf24", slate: "#94a3b8" }[c] }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={form.allDay} onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  All day
                </label>
                {!form.allDay && (
                  <>
                    <input type="time" value={form.time}
                      onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <select value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: Number(e.target.value) }))}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      {[15, 30, 45, 60, 90, 120].map((d) => (
                        <option key={d} value={d}>{d < 60 ? `${d}m` : `${d / 60}h`}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              {clients.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Client (optional)</label>
                  <div className="relative">
                    <select value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                      className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-8">
                      <option value="">No client</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {[c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed"}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}

              <textarea rows={2} placeholder="Description (optional)" value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setCreating(null)} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
              <button onClick={submitCreate} disabled={isPending || !form.title.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {isPending ? "Saving…" : "Create event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event detail popover */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded mb-2 ${COLOR_CLASSES[selectedEvent.color]}`}>
                  {TYPE_LABELS[selectedEvent.type]}
                </span>
                <h3 className={`text-base font-semibold text-slate-800 ${selectedEvent.completed ? "line-through opacity-50" : ""}`}>
                  {selectedEvent.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedEvent.all_day ? "All day" : new Date(selectedEvent.start_at).toLocaleTimeString("en-US", {
                    hour: "numeric", minute: "2-digit", weekday: "short", month: "short", day: "numeric",
                  })}
                </p>
                {selectedEvent.clients && (
                  <p className="text-xs text-slate-500 mt-1">
                    {[selectedEvent.clients.first_name, selectedEvent.clients.last_name].filter(Boolean).join(" ")}
                  </p>
                )}
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  startTransition(async () => {
                    await toggleEventComplete(selectedEvent.id, !selectedEvent.completed);
                    setSelectedEvent(null);
                  });
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2 border border-slate-200 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-50"
              >
                <Check className="w-4 h-4" />
                {selectedEvent.completed ? "Reopen" : "Complete"}
              </button>
              <button
                onClick={() => {
                  if (!confirm("Delete this event?")) return;
                  startTransition(async () => {
                    await deleteEvent(selectedEvent.id);
                    setSelectedEvent(null);
                  });
                }}
                className="p-2 border border-rose-200 text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
