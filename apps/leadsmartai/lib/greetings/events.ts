import type { GreetingEvent, GreetingLead } from "./types";
import { getHolidayForDate } from "./holidays";

function sameMonthDayUtc(today: Date, dateStr?: string | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  return d.getUTCMonth() === today.getUTCMonth() && d.getUTCDate() === today.getUTCDate();
}

const CHECKIN_MIN_DAYS_SINCE_CONTACT = 90;

/** Mid-month relationship check-in (UTC), when last touch was long ago. */
export function detectCheckinEvent(lead: GreetingLead, today = new Date()): GreetingEvent | null {
  if (today.getUTCDate() !== 15) return null;
  const last = lead.lastContactedAt ? new Date(lead.lastContactedAt) : null;
  if (!last || Number.isNaN(last.getTime())) return null;
  const days = (today.getTime() - last.getTime()) / 86400000;
  if (days < CHECKIN_MIN_DAYS_SINCE_CONTACT) return null;
  return { type: "checkin", scheduledDate: today.toISOString() };
}

export function detectGreetingEvents(lead: GreetingLead, today = new Date()): GreetingEvent[] {
  const events: GreetingEvent[] = [];

  if (sameMonthDayUtc(today, lead.birthday)) {
    events.push({ type: "birthday", scheduledDate: today.toISOString() });
  }

  if (sameMonthDayUtc(today, lead.homePurchaseDate)) {
    events.push({ type: "home_anniversary", scheduledDate: today.toISOString() });
  }

  const holiday = getHolidayForDate(today);
  if (holiday) {
    events.push({ type: "holiday", holidayKey: holiday.key, scheduledDate: today.toISOString() });
  }

  return events;
}

export const GREETING_EVENT_PRIORITY: Record<string, number> = {
  birthday: 0,
  home_anniversary: 1,
  holiday: 2,
  checkin: 3,
};

export function sortEventsByPriority(events: GreetingEvent[]) {
  return [...events].sort(
    (a, b) => (GREETING_EVENT_PRIORITY[a.type] ?? 99) - (GREETING_EVENT_PRIORITY[b.type] ?? 99)
  );
}
