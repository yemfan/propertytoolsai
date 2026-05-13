import "server-only";

/**
 * Recurrence math for Phase 2D recurring posts.
 *
 * Given a (cadence, weekly_day_of_week, time_of_day_hour,
 * time_of_day_minute, timezone) + a "from" instant, compute the
 * next firing instant. The materialize cron uses this to update
 * `recurring_post_schedules.next_occurrence_at` after it
 * materializes the current one.
 *
 * Why we don't use a cron-expression library: we only support two
 * cadences (daily, weekly), the recurrence config is highly
 * structured already, and we need IANA-timezone-aware "HH:MM in
 * <tz>" → instant math that node-cron / cron-parser don't do
 * natively. Native Intl APIs handle it correctly and DST-safely.
 *
 * Behavior:
 *   - Daily: next instant is today's HH:MM in <tz> if > from,
 *     else tomorrow's HH:MM.
 *   - Weekly: next instant is the upcoming weekly_day_of_week's
 *     HH:MM in <tz>. If today IS the configured day and HH:MM
 *     hasn't passed yet, today; otherwise 1-7 days ahead.
 */

export type Cadence = "daily" | "weekly";

export type RecurrenceConfig = {
  cadence: Cadence;
  /** 0=Sunday..6=Saturday. Required when cadence='weekly'. */
  weeklyDayOfWeek: number | null;
  timeOfDayHour: number;
  timeOfDayMinute: number;
  /** IANA timezone, e.g. 'America/Los_Angeles'. */
  timezone: string;
};

/**
 * Compute the wall-clock parts of an instant in a given timezone.
 * Returns the local Y/M/D + day-of-week (0=Sun..6=Sat) + H/M/S.
 *
 * Uses Intl.DateTimeFormat in en-CA locale to get unambiguous
 * yyyy-mm-dd parts (en-US uses m/d/yyyy which is ambiguous to
 * parse).
 */
function partsInTimezone(
  instant: Date,
  timezone: string,
): {
  year: number;
  month: number; // 1-12
  day: number;
  weekday: number; // 0=Sun..6=Sat
  hour: number;
  minute: number;
  second: number;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "0";

  const weekdayShort = get("weekday");
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  // en-CA uses "00" for midnight hour, not "24"
  const hour = parseInt(get("hour"), 10) % 24;
  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    weekday: weekdayMap[weekdayShort] ?? 0,
    hour,
    minute: parseInt(get("minute"), 10),
    second: parseInt(get("second"), 10),
  };
}

/**
 * Build a UTC instant from local wall-clock fields (Y/M/D H:M in
 * a given timezone). DST-safe via Intl.DateTimeFormat round-trip.
 *
 * The "guess + correct" approach: first build a naive UTC instant
 * using the local fields, then check what the timezone says that
 * UTC instant resolves to. The delta tells us how much to shift.
 *
 * This is the standard technique because JS lacks a "construct a
 * Date from local time in a specific zone" primitive (Date only
 * knows the runtime's TZ + UTC).
 */
function utcFromLocal(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  // First guess: treat the wall-clock as UTC. This gives us a Date
  // that's at the wrong instant but with the right "shape".
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  // Now ask: when this guess instant is viewed in <timezone>, what
  // wall-clock does it show? The diff between that wall-clock and
  // our target wall-clock IS the timezone offset.
  const observed = partsInTimezone(guess, timezone);
  const targetMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const observedMs = Date.UTC(
    observed.year,
    observed.month - 1,
    observed.day,
    observed.hour,
    observed.minute,
    observed.second,
  );
  // observed - target = how much our guess is ahead of the target
  // when viewed in <timezone>. To make a wall-clock of <target> in
  // <timezone>, the UTC instant must be: guess + (target - observed).
  const offset = targetMs - observedMs;
  return new Date(guess.getTime() + offset);
}

/**
 * Compute the next firing instant of a recurrence after `from`.
 *
 * "After" is strict-greater: if `from === HH:MM today` exactly, the
 * next instant is the next cadence step, NOT `from` itself. This
 * prevents the materialize cron from re-firing the same occurrence
 * when called twice within a minute.
 */
export function computeNextOccurrence(
  config: RecurrenceConfig,
  from: Date,
): Date {
  if (config.cadence !== "weekly" && config.cadence !== "daily") {
    throw new Error(`Unsupported cadence: ${config.cadence}`);
  }
  if (config.cadence === "weekly" && config.weeklyDayOfWeek === null) {
    throw new Error("Weekly cadence requires weeklyDayOfWeek");
  }

  const local = partsInTimezone(from, config.timezone);

  if (config.cadence === "daily") {
    // Today's HH:MM in tz.
    const todayAt = utcFromLocal(
      local.year,
      local.month,
      local.day,
      config.timeOfDayHour,
      config.timeOfDayMinute,
      config.timezone,
    );
    if (todayAt.getTime() > from.getTime()) {
      return todayAt;
    }
    // Roll to tomorrow.
    const tomorrow = new Date(
      Date.UTC(local.year, local.month - 1, local.day + 1),
    );
    const localTomorrow = partsInTimezone(tomorrow, config.timezone);
    return utcFromLocal(
      localTomorrow.year,
      localTomorrow.month,
      localTomorrow.day,
      config.timeOfDayHour,
      config.timeOfDayMinute,
      config.timezone,
    );
  }

  // Weekly. Walk forward day-by-day until we hit the target weekday
  // AT the target HH:MM strictly-after `from`.
  const target = config.weeklyDayOfWeek as number;
  for (let offsetDays = 0; offsetDays <= 7; offsetDays++) {
    const candidate = new Date(
      Date.UTC(local.year, local.month - 1, local.day + offsetDays),
    );
    const candidateLocal = partsInTimezone(candidate, config.timezone);
    if (candidateLocal.weekday !== target) continue;
    const candidateAt = utcFromLocal(
      candidateLocal.year,
      candidateLocal.month,
      candidateLocal.day,
      config.timeOfDayHour,
      config.timeOfDayMinute,
      config.timezone,
    );
    if (candidateAt.getTime() > from.getTime()) {
      return candidateAt;
    }
  }
  // Should never reach here — the 0..7 window always contains one
  // hit for the target weekday, and the strict-greater check skips
  // at most one of them (when from is exactly on the boundary).
  throw new Error("computeNextOccurrence: no weekly candidate found");
}
