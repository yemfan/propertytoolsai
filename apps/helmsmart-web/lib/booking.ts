import { createServiceClient } from "@/lib/supabase/server";
import { getGoogleFreeBusy, upsertGoogleEvent, type BusyInterval } from "@/lib/google-calendar";
import { type BusinessHours } from "@/lib/receptionist";
import { speakTime, zonedToUtc, normalizeDateStr, resolveStartMs } from "@repo/voice/datetime";
import {
  overlapsBusy,
  nextOpenDay,
  generateDaySlots,
  validateBookingTime,
} from "@repo/voice/scheduling";
import { DEFAULT_APPOINTMENT_MINUTES, splitCallerName, appointmentTitle } from "@helm/dna-service";

// The receptionist's booking engine: availability (business hours ∩ free/busy)
// and conflict-safe booking. Service-client based — runs in the voice webhook.
// The pure date/time parsing it relies on lives in @repo/voice/datetime.

// Re-exported so existing `@/lib/booking` importers of these keep working.
export { normalizeDateStr, resolveStartMs };

const DEFAULT_TZ = "America/New_York";
const SLOT_STEP_MS = 30 * 60_000;

async function loadOrg(orgId: string): Promise<{ timezone: string; hours: BusinessHours | null }> {
  const db = await createServiceClient();
  const { data } = await db.from("organizations").select("timezone, business_hours").eq("id", orgId).single();
  return {
    timezone: (data?.timezone as string) || DEFAULT_TZ,
    hours: (data?.business_hours as BusinessHours | null) ?? null,
  };
}

async function findType(orgId: string, name: string): Promise<{ id: string; name: string; duration_minutes: number } | null> {
  const db = await createServiceClient();
  const { data } = await db
    .from("appointment_types")
    .select("id, name, duration_minutes")
    .eq("organization_id", orgId)
    .eq("active", true)
    .ilike("name", `%${name}%`)
    .limit(1)
    .maybeSingle();
  return (data as { id: string; name: string; duration_minutes: number } | null) ?? null;
}

/** Busy intervals from Google Calendar (if connected) else internal events. */
async function busyIntervals(orgId: string, startUtc: Date, endUtc: Date): Promise<BusyInterval[]> {
  const gcal = await getGoogleFreeBusy(orgId, startUtc.toISOString(), endUtc.toISOString());
  if (gcal !== null) return gcal;

  const db = await createServiceClient();
  const { data } = await db
    .from("events")
    .select("start_at, end_at")
    .eq("organization_id", orgId)
    .gte("start_at", new Date(startUtc.getTime() - 6 * 3600_000).toISOString())
    .lt("start_at", endUtc.toISOString());
  return (data ?? []).map((e) => {
    const start = e.start_at as string;
    const end = (e.end_at as string | null) ?? new Date(new Date(start).getTime() + SLOT_STEP_MS).toISOString();
    return { start, end };
  });
}

export type AvailabilityResult = {
  closed: boolean;
  durationMinutes: number;
  slots: { startISO: string; label: string }[];
};

/** Open slots for an appointment type on a given date (YYYY-MM-DD). */
export async function getAvailability(orgId: string, appointmentTypeName: string, dateStr: string): Promise<AvailabilityResult> {
  const { timezone, hours } = await loadOrg(orgId);
  const type = await findType(orgId, appointmentTypeName);
  const duration = type?.duration_minutes ?? DEFAULT_APPOINTMENT_MINUTES;

  // Normalize whatever the agent sent (weekday name, natural date, …) to a real
  // calendar date, then roll forward past closed days (weekends/holidays) to the
  // next open day so the caller is always offered real times.
  const todayISO = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  // Normalize the requested date, then roll forward to the next open day so the
  // caller is always offered real times (shared @repo/voice/scheduling core).
  const date0 = normalizeDateStr(dateStr, todayISO);
  const open = nextOpenDay(date0, hours);
  if (!open) return { closed: true, durationMinutes: duration, slots: [] };

  const openUtc = zonedToUtc(open.date, open.open, timezone);
  const closeUtc = zonedToUtc(open.date, open.close, timezone);
  const busy = await busyIntervals(orgId, openUtc, closeUtc);
  const slots = generateDaySlots({
    date: open.date,
    open: open.open,
    close: open.close,
    timezone,
    busy,
    durationMin: duration,
    now: Date.now(),
  });
  return { closed: false, durationMinutes: duration, slots };
}

export type BookResult = { ok: boolean; reason?: string; startISO?: string; label?: string; eventId?: string; title?: string };

/** Book a specific slot — re-validates, writes to Google Calendar (if connected) + the internal calendar. */
export async function bookAppointment(
  orgId: string,
  input: {
    appointmentTypeName: string;
    startISO?: string;
    dateStr?: string;
    timeStr?: string;
    clientId?: string | null;
    callerName?: string | null;
  }
): Promise<BookResult> {
  const { timezone, hours } = await loadOrg(orgId);
  const type = await findType(orgId, input.appointmentTypeName);
  const duration = type?.duration_minutes ?? DEFAULT_APPOINTMENT_MINUTES;

  let startMs = resolveStartMs(input.startISO, input.dateStr, input.timeStr, timezone);
  if (startMs === null || startMs < Date.now()) {
    return { ok: false, reason: "That time isn't valid or is in the past." };
  }

  // Keep appointments inside business hours. A closed-day request rolls forward to
  // the next open day (same as check_availability) so the booking lands on a real
  // open day; the time of day must then sit inside that day's open–close window.
  // (After-hours emergencies are handled live by the agent, not booked.)
  // Keep the booking inside business hours (shared core): a closed-day request
  // rolls forward to the next open day, then the time must sit inside open–close.
  const inHours = validateBookingTime({ startMs, durationMin: duration, hours, timezone });
  if (!inHours.ok) return { ok: false, reason: inHours.reason };
  startMs = inHours.startMs;
  const endMs = startMs + duration * 60_000;
  const title = appointmentTitle(type?.name, input.callerName);
  const startISO = new Date(startMs).toISOString();
  const endISO = new Date(endMs).toISOString();
  const db = await createServiceClient();
  const fmtLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });

  // Idempotency: the agent (or Retell) sometimes calls book_appointment more than
  // once in a call. If THIS caller already holds this exact slot, treat the repeat
  // as success rather than "that time was just taken".
  if (input.clientId) {
    const { data: dupe } = await db
      .from("events")
      .select("id")
      .eq("organization_id", orgId)
      .eq("client_id", input.clientId)
      .eq("start_at", startISO)
      .maybeSingle();
    if (dupe) return { ok: true, startISO, label: speakTime(fmtLabel.format(new Date(startMs))), eventId: dupe.id as string, title };
  }

  const busy = await busyIntervals(orgId, new Date(startMs - 1), new Date(endMs + 1));
  if (overlapsBusy(startMs, endMs, busy)) return { ok: false, reason: "That time was just taken." };

  // smbai's internal calendar first. The unique index on (organization_id,
  // start_at) for appointments makes a same-slot double-booking impossible even
  // under a race — the Retell agent fires book_appointment several times per call.
  // Insert before the Google sync so a race-loser doesn't orphan a Google event.
  const { data: evt, error: insErr } = await db
    .from("events")
    .insert({
      organization_id: orgId,
      client_id: input.clientId ?? null,
      title,
      type: "appointment",
      color: "indigo",
      start_at: startISO,
      end_at: endISO,
      all_day: false,
      completed: false,
    })
    .select("id")
    .single();

  if (insErr) {
    // 23505 = unique violation: a concurrent booking already took this exact slot.
    if (insErr.code === "23505") {
      const { data: held } = await db
        .from("events")
        .select("id, client_id")
        .eq("organization_id", orgId)
        .eq("type", "appointment")
        .eq("start_at", startISO)
        .maybeSingle();
      // Same caller racing themselves → return the booking they wanted (idempotent).
      if (held && held.client_id === (input.clientId ?? null)) {
        return { ok: true, startISO, label: speakTime(fmtLabel.format(new Date(startMs))), eventId: held.id as string, title };
      }
      return { ok: false, reason: "That time was just taken." };
    }
    return { ok: false, reason: "I couldn't save that booking — let's try another time." };
  }

  // Owner's real calendar (no-op if not connected) — only after the slot is ours.
  await upsertGoogleEvent({ orgId, title, startAt: startISO, endAt: endISO, timezone });

  return { ok: true, startISO, label: speakTime(fmtLabel.format(new Date(startMs))), eventId: evt?.id, title };
}

/** Match a caller to a client by phone, creating a lightweight one if new. */
export async function matchOrCreateClient(orgId: string, phone: string, name?: string | null): Promise<string | null> {
  const db = await createServiceClient();
  const { data: existing } = await db
    .from("clients")
    .select("id")
    .eq("organization_id", orgId)
    .eq("phone", phone)
    .maybeSingle();
  if (existing) return existing.id;

  const { firstName, lastName } = splitCallerName(name);
  const { data: created } = await db
    .from("clients")
    .insert({
      organization_id: orgId,
      first_name: firstName,
      last_name: lastName,
      phone,
      status: "lead",
      source: "voice",
    })
    .select("id")
    .single();
  return created?.id ?? null;
}
