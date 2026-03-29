"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type CalendarEvent = {
  id: string;
  lead_id: string;
  lead_name: string | null;
  title: string;
  starts_at: string;
  calendar_provider: string | null;
};

type LeadTask = {
  id: string;
  lead_id: string;
  lead_name: string | null;
  title: string;
  due_at: string | null;
  priority: string;
};

type FollowUp = {
  lead_id: string;
  lead_name: string | null;
  next_contact_at: string;
  overdue: boolean;
};

export default function DashboardCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<LeadTask[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [remindersErr, setRemindersErr] = useState<string | null>(null);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setRemindersErr(null);
    try {
      const [evRes, remRes] = await Promise.all([
        fetch("/api/dashboard/calendar/events", { credentials: "include" }),
        fetch("/api/dashboard/reminders", { credentials: "include" }),
      ]);
      const evJson = (await evRes.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        events?: CalendarEvent[];
      };
      const remJson = (await remRes.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        upcoming_appointments?: CalendarEvent[];
        overdue_tasks?: LeadTask[];
        follow_ups?: FollowUp[];
      };

      if (!evRes.ok || !evJson.ok) {
        throw new Error(evJson.error ?? "Could not load appointments.");
      }
      setEvents(evJson.events ?? []);

      if (!remRes.ok || !remJson.ok) {
        setRemindersErr(remJson.error ?? "Could not load reminders.");
        setOverdueTasks([]);
        setFollowUps([]);
      } else {
        setOverdueTasks(remJson.overdue_tasks ?? []);
        setFollowUps(remJson.follow_ups ?? []);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Load failed.");
      setEvents([]);
      setOverdueTasks([]);
      setFollowUps([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function cancelEvent(id: string) {
    setBusyEventId(id);
    try {
      const res = await fetch(`/api/dashboard/calendar/events/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Cancel failed.");
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Cancel failed.");
    } finally {
      setBusyEventId(null);
    }
  }

  async function completeTask(id: string) {
    setBusyTaskId(id);
    try {
      const res = await fetch(`/api/dashboard/lead-tasks/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Update failed.");
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusyTaskId(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="ui-page-title text-brand-text">Calendar</h1>
        <p className="text-sm text-slate-600 mt-2">Loading…</p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="ui-page-title text-brand-text">Calendar</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="ui-page-title text-brand-text">Calendar & reminders</h1>
        <p className="ui-page-subtitle text-brand-text/80 mt-1">
          Upcoming appointments, overdue lead tasks, and follow-up dates. Matches the LeadSmart mobile app.
        </p>
      </div>

      {remindersErr ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Reminders partially unavailable: {remindersErr}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Appointments</h2>
        <p className="text-xs text-slate-500 mt-1">Scheduled on your leads (next ~90 days).</p>
        {events.length === 0 ? (
          <p className="text-sm text-slate-600 mt-4">No upcoming appointments. Add one from a lead or the mobile app.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{ev.title}</div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {ev.lead_name ?? `Lead ${ev.lead_id}`} · {new Date(ev.starts_at).toLocaleString()}
                    {ev.calendar_provider ? ` · ${ev.calendar_provider}` : ""}
                  </div>
                  <Link
                    href="/dashboard/leads"
                    className="text-xs font-semibold text-brand-primary hover:underline mt-1 inline-block"
                  >
                    Open Leads
                  </Link>
                </div>
                <button
                  type="button"
                  disabled={busyEventId === ev.id}
                  onClick={() => void cancelEvent(ev.id)}
                  className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  {busyEventId === ev.id ? "…" : "Cancel"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Overdue tasks</h2>
        <p className="text-xs text-slate-500 mt-1">Open tasks on `lead_tasks` past due (UTC day).</p>
        {overdueTasks.length === 0 ? (
          <p className="text-sm text-slate-600 mt-4">None — you’re caught up.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {overdueTasks.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50/50 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900">{t.title}</div>
                  <div className="text-xs text-slate-600">
                    {t.lead_name ?? `Lead ${t.lead_id}`}
                    {t.due_at ? ` · due ${new Date(t.due_at).toLocaleString()}` : ""} · {t.priority}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busyTaskId === t.id}
                  onClick={() => void completeTask(t.id)}
                  className="shrink-0 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#005ca8] disabled:opacity-50"
                >
                  {busyTaskId === t.id ? "…" : "Mark done"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Follow-ups</h2>
        <p className="text-xs text-slate-500 mt-1">From each lead’s next contact date.</p>
        {followUps.length === 0 ? (
          <p className="text-sm text-slate-600 mt-4">No follow-up dates set on leads.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {followUps.map((f) => (
              <li
                key={`${f.lead_id}-${f.next_contact_at}`}
                className={`rounded-xl border px-4 py-3 text-sm ${
                  f.overdue
                    ? "border-amber-200 bg-amber-50 text-amber-950"
                    : "border-slate-100 bg-slate-50 text-slate-900"
                }`}
              >
                <span className="font-semibold">{f.lead_name ?? `Lead ${f.lead_id}`}</span>
                <span className="text-slate-600">
                  {" "}
                  — {f.overdue ? "Overdue" : "Due"}{" "}
                  {new Date(f.next_contact_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
