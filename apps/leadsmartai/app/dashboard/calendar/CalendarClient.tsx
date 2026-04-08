"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type CalendarEvent = { id: string; lead_id: string; lead_name: string | null; title: string; starts_at: string; };
type TaskItem = { id: string; lead_id: string | null; lead_name: string | null; title: string; due_at: string | null; priority: string; status: string; };
type FollowUp = { lead_id: string; lead_name: string | null; next_contact_at: string; overdue: boolean; };
type DayEntry = { type: "event" | "task" | "followup"; id: string; title: string; leadName: string | null; time: string; priority?: string; status?: string; overdue?: boolean; };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOT_COLORS = { event: "bg-blue-500", task: "bg-green-500", followup: "bg-amber-500" };

function dateKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function isSameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function formatTime(iso: string) { return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }

export default function CalendarClient({ leads }: { leads: Array<{ id: string; name: string | null }> }) {
  const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<"event" | "task">("event");
  const [addFields, setAddFields] = useState({ title: "", leadId: "", startsAt: "", dueAt: "", priority: "normal" });
  const [addLoading, setAddLoading] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);
  const [showEvents, setShowEvents] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showFollowups, setShowFollowups] = useState(true);
  const [gcalStatus, setGcalStatus] = useState<{ configured: boolean; connected: boolean } | null>(null);
  const [gcalDisconnecting, setGcalDisconnecting] = useState(false);

  const loadData = useCallback(async () => {
    const from = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString();
    const to = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const [evRes, tkRes, fuRes] = await Promise.all([
      fetch(`/api/dashboard/calendar/events?from=${from}&to=${to}`).then((r) => r.json()).catch(() => ({})),
      fetch("/api/dashboard/tasks?status=all").then((r) => r.json()).catch(() => ({})),
      fetch("/api/dashboard/reminders").then((r) => r.json()).catch(() => ({})),
    ]);
    setEvents(evRes.ok ? (evRes.events ?? []) : []);
    setTasks(tkRes.ok ? (tkRes.tasks ?? []) : []);
    setFollowups(fuRes.ok ? (fuRes.followUps ?? fuRes.followups ?? []) : []);
  }, [currentMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    fetch("/api/dashboard/calendar/google-status").then((r) => r.json()).then((b) => {
      if (b.ok) setGcalStatus({ configured: b.configured, connected: b.connected });
    }).catch(() => {});
  }, []);

  // Build day → entries map
  const dayMap = useMemo(() => {
    const map = new Map<string, DayEntry[]>();
    const add = (key: string, entry: DayEntry) => {
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    };
    if (showEvents) for (const e of events) {
      const k = dateKey(new Date(e.starts_at));
      add(k, { type: "event", id: e.id, title: e.title, leadName: e.lead_name, time: e.starts_at });
    }
    if (showTasks) for (const t of tasks) {
      if (!t.due_at) continue;
      const k = dateKey(new Date(t.due_at));
      add(k, { type: "task", id: t.id, title: t.title, leadName: t.lead_name, time: t.due_at, priority: t.priority, status: t.status });
    }
    if (showFollowups) for (const f of followups) {
      const k = dateKey(new Date(f.next_contact_at));
      add(k, { type: "followup", id: f.lead_id, title: `Follow up with ${f.lead_name ?? "lead"}`, leadName: f.lead_name, time: f.next_contact_at, overdue: f.overdue });
    }
    return map;
  }, [events, tasks, followups, showEvents, showTasks, showFollowups]);

  // Month grid
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((startOffset + daysInMonth) / 7);
  const today = new Date();

  const monthStats = useMemo(() => {
    let evCount = 0, tkCount = 0, fuCount = 0;
    dayMap.forEach((entries) => {
      for (const e of entries) {
        if (e.type === "event") evCount++;
        else if (e.type === "task") tkCount++;
        else fuCount++;
      }
    });
    return { events: evCount, tasks: tkCount, followups: fuCount };
  }, [dayMap]);

  const selectedEntries = selectedDate ? (dayMap.get(dateKey(selectedDate)) ?? []) : [];

  function prevMonth() { setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)); }
  function nextMonth() { setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)); }
  function goToday() { const d = new Date(); setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSelectedDate(d); }

  async function addItem() {
    setAddLoading(true); setAddMsg(null);
    try {
      if (addType === "event") {
        const res = await fetch("/api/dashboard/calendar/events", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: addFields.title, leadId: addFields.leadId || null, startsAt: addFields.startsAt ? new Date(addFields.startsAt).toISOString() : null }),
        });
        if (!(await res.json()).ok) throw new Error("Failed");
      } else {
        const res = await fetch("/api/dashboard/tasks", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: addFields.title, leadId: addFields.leadId || null, dueAt: addFields.dueAt ? new Date(addFields.dueAt).toISOString() : null, priority: addFields.priority }),
        });
        if (!(await res.json()).ok) throw new Error("Failed");
      }
      setAddMsg("Added!"); setShowAdd(false);
      setAddFields({ title: "", leadId: "", startsAt: "", dueAt: "", priority: "normal" });
      loadData();
    } catch { setAddMsg("Failed to add."); }
    finally { setAddLoading(false); }
  }

  async function markTaskDone(taskId: string) {
    await fetch("/api/dashboard/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId, status: "done" }) });
    loadData();
  }

  async function cancelEvent(eventId: string) {
    await fetch(`/api/dashboard/calendar/events/${eventId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
    loadData();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500">
            {monthStats.events} appointments &middot; {monthStats.tasks} tasks &middot; {monthStats.followups} follow-ups
          </p>
        </div>
        <button onClick={() => setShowAdd((v) => !v)} className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800">
          {showAdd ? "Cancel" : "Add Event"}
        </button>
      </div>

      {/* Google Calendar integration */}
      {gcalStatus?.configured && (
        <div className={`flex items-center justify-between rounded-xl border p-4 ${gcalStatus.connected ? "border-green-200 bg-green-50" : "border-blue-200 bg-blue-50"}`}>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {gcalStatus.connected ? "Google Calendar connected" : "Sync with Google Calendar"}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {gcalStatus.connected
                ? "New appointments auto-sync to your Google Calendar."
                : "Connect to automatically sync appointments both ways."}
            </p>
          </div>
          {gcalStatus.connected ? (
            <button
              onClick={async () => {
                setGcalDisconnecting(true);
                await fetch("/api/auth/google-calendar/disconnect", { method: "POST" }).catch(() => {});
                setGcalStatus({ configured: true, connected: false });
                setGcalDisconnecting(false);
              }}
              disabled={gcalDisconnecting}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {gcalDisconnecting ? "..." : "Disconnect"}
            </button>
          ) : (
            <a
              href="/api/auth/google-calendar"
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Connect
            </a>
          )}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setAddType("event")} className={`rounded-lg px-3 py-1 text-xs font-medium ${addType === "event" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}>Appointment</button>
            <button onClick={() => setAddType("task")} className={`rounded-lg px-3 py-1 text-xs font-medium ${addType === "task" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700"}`}>Task</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={addFields.title} onChange={(e) => setAddFields((f) => ({ ...f, title: e.target.value }))} placeholder="Title *" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <select value={addFields.leadId} onChange={(e) => setAddFields((f) => ({ ...f, leadId: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">No contact</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.name ?? `Lead #${l.id}`}</option>)}
            </select>
            {addType === "event" ? (
              <input type="datetime-local" value={addFields.startsAt} onChange={(e) => setAddFields((f) => ({ ...f, startsAt: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            ) : (
              <>
                <input type="datetime-local" value={addFields.dueAt} onChange={(e) => setAddFields((f) => ({ ...f, dueAt: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <select value={addFields.priority} onChange={(e) => setAddFields((f) => ({ ...f, priority: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
                </select>
              </>
            )}
          </div>
          {addMsg && <p className={`text-xs ${addMsg === "Added!" ? "text-green-700" : "text-red-600"}`}>{addMsg}</p>}
          <button onClick={() => void addItem()} disabled={addLoading || !addFields.title.trim()} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
            {addLoading ? "Adding..." : "Add"}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <button onClick={() => { setShowEvents(true); setShowTasks(true); setShowFollowups(true); }} className={`rounded-lg px-3 py-1 text-xs font-medium ${showEvents && showTasks && showFollowups ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}>
          All
        </button>
        <button onClick={() => { setShowEvents(true); setShowTasks(false); setShowFollowups(false); }} className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium ${showEvents && !showTasks && !showFollowups ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
          <span className="h-2 w-2 rounded-full bg-blue-500" /> Appointments
        </button>
        <button onClick={() => { setShowEvents(false); setShowTasks(true); setShowFollowups(false); }} className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium ${!showEvents && showTasks && !showFollowups ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          <span className="h-2 w-2 rounded-full bg-green-500" /> Tasks
        </button>
        <button onClick={() => { setShowEvents(false); setShowTasks(false); setShowFollowups(true); }} className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium ${!showEvents && !showTasks && showFollowups ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
          <span className="h-2 w-2 rounded-full bg-amber-500" /> Follow-ups
        </button>
      </div>

      {/* Month navigation */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <button onClick={prevMonth} className="rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50">&larr;</button>
          <div className="text-center">
            <h2 className="text-sm font-semibold text-gray-900">
              {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </h2>
          </div>
          <div className="flex gap-2">
            <button onClick={goToday} className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">Today</button>
            <button onClick={nextMonth} className="rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50">&rarr;</button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
          {DAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-[10px] font-semibold text-gray-500">{d}</div>
          ))}
        </div>

        {/* Month grid */}
        <div className="grid grid-cols-7">
          {Array.from({ length: weeks * 7 }).map((_, i) => {
            const dayNum = i - startOffset + 1;
            const isValid = dayNum >= 1 && dayNum <= daysInMonth;
            const date = isValid ? new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayNum) : null;
            const key = date ? dateKey(date) : "";
            const entries = date ? (dayMap.get(key) ?? []) : [];
            const isToday = date && isSameDay(date, today);
            const isSelected = date && selectedDate && isSameDay(date, selectedDate);
            const hasEvents = entries.some((e) => e.type === "event");
            const hasTasks = entries.some((e) => e.type === "task");
            const hasFollowups = entries.some((e) => e.type === "followup");

            return (
              <button
                key={i}
                type="button"
                disabled={!isValid}
                onClick={() => date && setSelectedDate(date)}
                className={`min-h-[60px] border-b border-r border-gray-50 px-1 py-1 text-left transition ${
                  !isValid ? "bg-gray-50/50" :
                  isSelected ? "bg-blue-50" :
                  isToday ? "bg-amber-50/50" :
                  "hover:bg-gray-50"
                }`}
              >
                {isValid && (
                  <>
                    <span className={`text-xs ${isToday ? "font-bold text-blue-600" : isSelected ? "font-semibold text-gray-900" : "text-gray-600"}`}>
                      {dayNum}
                    </span>
                    <div className="flex gap-0.5 mt-0.5">
                      {hasEvents && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                      {hasTasks && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                      {hasFollowups && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                    </div>
                    {entries.length > 0 && (
                      <div className="mt-0.5">
                        {entries.slice(0, 2).map((e, j) => (
                          <div key={j} className={`truncate text-[9px] leading-tight ${e.type === "event" ? "text-blue-700" : e.type === "task" ? "text-green-700" : "text-amber-700"}`}>
                            {e.title}
                          </div>
                        ))}
                        {entries.length > 2 && <div className="text-[9px] text-gray-400">+{entries.length - 2} more</div>}
                      </div>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day detail panel */}
      {selectedDate && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">
            {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </h3>
          {selectedEntries.length === 0 ? (
            <p className="mt-2 text-sm text-gray-400">No events on this day.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {selectedEntries.map((entry, i) => (
                <div key={`${entry.type}-${entry.id}-${i}`} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${DOT_COLORS[entry.type]}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{entry.title}</p>
                      <p className="text-xs text-gray-500">
                        {entry.leadName && <span>{entry.leadName} &middot; </span>}
                        {formatTime(entry.time)}
                        {entry.priority && entry.priority !== "normal" && <span className="ml-1 capitalize text-amber-600">{entry.priority}</span>}
                        {entry.overdue && <span className="ml-1 text-red-600">Overdue</span>}
                        {entry.status === "done" && <span className="ml-1 text-green-600">Done</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-2">
                    {entry.type === "task" && entry.status !== "done" && (
                      <button onClick={() => void markTaskDone(entry.id)} className="rounded-lg bg-green-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-green-700">Done</button>
                    )}
                    {entry.type === "event" && (
                      <button onClick={() => void cancelEvent(entry.id)} className="rounded-lg border border-red-200 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50">Cancel</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
