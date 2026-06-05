/**
 * Recurrence helpers — compute the next run time for recurring schedules.
 * Pure functions (no "use server") so they can be unit-tested and shared.
 */

export type RecurrenceInterval = "weekly" | "monthly";

/**
 * Compute the next run timestamp for a recurring campaign.
 *
 * @param interval  "weekly" | "monthly"
 * @param day       weekly: 0-6 (Sun=0); monthly: 1-28 (day of month)
 * @param hour      hour of day (UTC, 0-23)
 * @param from      base time to compute the next occurrence after (defaults must be passed in — no Date.now() here)
 * @returns ISO timestamp of the next occurrence strictly after `from`
 */
export function computeNextRun(
  interval: RecurrenceInterval,
  day: number,
  hour: number,
  from: Date
): string {
  const next = new Date(from.getTime());
  next.setUTCHours(hour, 0, 0, 0);

  if (interval === "weekly") {
    const targetDow = Math.max(0, Math.min(6, day));
    // Advance to the target day-of-week
    let daysAhead = (targetDow - next.getUTCDay() + 7) % 7;
    // If it's the same day but the time has already passed, push a week
    if (daysAhead === 0 && next.getTime() <= from.getTime()) {
      daysAhead = 7;
    }
    next.setUTCDate(next.getUTCDate() + daysAhead);
    // If still not strictly after `from` (e.g. daysAhead computed to 0 with future hour), good
    if (next.getTime() <= from.getTime()) {
      next.setUTCDate(next.getUTCDate() + 7);
    }
    return next.toISOString();
  }

  // monthly
  const targetDom = Math.max(1, Math.min(28, day));
  next.setUTCDate(targetDom);
  if (next.getTime() <= from.getTime()) {
    // Move to next month
    next.setUTCMonth(next.getUTCMonth() + 1);
    next.setUTCDate(targetDom);
  }
  return next.toISOString();
}

const DOW_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Human-readable description of a recurrence schedule.
 */
export function describeRecurrence(
  interval: RecurrenceInterval,
  day: number,
  hour: number
): string {
  const hh = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? "AM" : "PM";
  const time = `${hh}:00 ${ampm} UTC`;

  if (interval === "weekly") {
    return `Every ${DOW_LABELS[Math.max(0, Math.min(6, day))]} at ${time}`;
  }
  const dom = Math.max(1, Math.min(28, day));
  const suffix = dom === 1 ? "st" : dom === 2 ? "nd" : dom === 3 ? "rd" : "th";
  return `Monthly on the ${dom}${suffix} at ${time}`;
}
