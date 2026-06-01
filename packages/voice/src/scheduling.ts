/**
 * Shared, model-agnostic scheduling core for the AI receptionist's booking flow.
 *
 * Pure functions over plain values (business hours, busy intervals, timezone) —
 * no database. Each app supplies its own DB layer (load hours, read existing
 * appointments, insert the booking) and reuses this for the availability math
 * and business-hours validation, so every app offers identical, correct slots.
 *
 * Extracted from smbai's booking engine so leadsmartai and smbai share one
 * implementation of the tricky parts (timezone/DST math, closed-day roll-forward,
 * slot generation, in-hours validation).
 */

import { weekdayKey, zonedToUtc, addDaysISO, speakTime } from "./datetime";
import type { BusinessHours } from "./brain";

export type BusyInterval = { start: string; end: string };
export type Slot = { startISO: string; label: string };

export const SLOT_STEP_MS = 30 * 60_000;

/** True if [startMs, endMs) overlaps any busy interval. */
export function overlapsBusy(startMs: number, endMs: number, busy: BusyInterval[]): boolean {
  return busy.some((b) => startMs < new Date(b.end).getTime() && endMs > new Date(b.start).getTime());
}

/**
 * Roll `dateStr` (YYYY-MM-DD) forward to the next open day in `hours`, returning
 * that day's date + open/close times. Null if nothing is open within `maxGuard`
 * days (or hours is null). So a weekend/holiday request always lands on a real
 * open day, and the caller is offered real times.
 */
export function nextOpenDay(
  dateStr: string,
  hours: BusinessHours | null,
  maxGuard = 14,
): { date: string; open: string; close: string } | null {
  let date = dateStr;
  let dayHours = hours?.[weekdayKey(date)] ?? null;
  for (let guard = 0; !dayHours && guard < maxGuard; guard++) {
    date = addDaysISO(date, 1);
    dayHours = hours?.[weekdayKey(date)] ?? null;
  }
  if (!dayHours) return null;
  return { date, open: dayHours.open, close: dayHours.close };
}

/** Open appointment slots on one already-resolved open day (offered as start
 *  times stepped by SLOT_STEP_MS, skipping past times and busy overlaps). */
export function generateDaySlots(params: {
  date: string;
  open: string;
  close: string;
  timezone: string;
  busy: BusyInterval[];
  durationMin: number;
  now: number;
  max?: number;
}): Slot[] {
  const { date, open, close, timezone, busy, durationMin, now } = params;
  const max = params.max ?? 5;
  const openUtc = zonedToUtc(date, open, timezone).getTime();
  const closeUtc = zonedToUtc(date, close, timezone).getTime();
  const durMs = durationMin * 60_000;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const slots: Slot[] = [];
  for (let t = openUtc; t + durMs <= closeUtc; t += SLOT_STEP_MS) {
    if (t < now) continue;
    if (overlapsBusy(t, t + durMs, busy)) continue;
    slots.push({ startISO: new Date(t).toISOString(), label: speakTime(fmt.format(new Date(t))) });
    if (slots.length >= max) break;
  }
  return slots;
}

export type BookingTimeCheck = { ok: true; startMs: number } | { ok: false; reason: string };

/**
 * Validate a requested start against business hours: roll a closed-day request
 * forward to the next open day (keeping the time of day), then require the time
 * to sit inside that day's open–close window. Always ok when hours is null. Pure
 * — the caller still does the conflict check + insert with the returned startMs.
 */
export function validateBookingTime(params: {
  startMs: number;
  durationMin: number;
  hours: BusinessHours | null;
  timezone: string;
  maxGuard?: number;
}): BookingTimeCheck {
  const { hours, timezone, durationMin } = params;
  let startMs = params.startMs;
  if (!hours) return { ok: true, startMs };

  const fmtDate = (ms: number) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ms));

  let dayHours = hours[weekdayKey(fmtDate(startMs))] ?? null;
  const maxGuard = params.maxGuard ?? 14;
  for (let guard = 0; !dayHours && guard < maxGuard; guard++) {
    startMs += 24 * 60 * 60_000; // advance one day, keep the time of day
    dayHours = hours[weekdayKey(fmtDate(startMs))] ?? null;
  }
  if (!dayHours) return { ok: false, reason: "We're closed then. Offer a day within business hours." };

  const slotDate = fmtDate(startMs);
  const openMs = zonedToUtc(slotDate, dayHours.open, timezone).getTime();
  const closeMs = zonedToUtc(slotDate, dayHours.close, timezone).getTime();
  if (startMs < openMs || startMs + durationMin * 60_000 > closeMs) {
    return {
      ok: false,
      reason: `That time is outside business hours (${dayHours.open}–${dayHours.close}). Offer a time within hours.`,
    };
  }
  return { ok: true, startMs };
}
