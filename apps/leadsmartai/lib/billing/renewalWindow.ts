/**
 * Pure helper — returns the (start, end) ISO timestamps for the
 * 30-day reminder window. Lives in its own file so unit tests can
 * import it without dragging in the Supabase admin client (which
 * requires env vars at module load).
 */
export function renewalReminderWindow(now: Date = new Date()): {
  windowStart: string;
  windowEnd: string;
} {
  // We want subscriptions where current_period_end is approximately
  // 30 days from now. Use a 5-day window (27.5 → 32.5 days out) to
  // ride out cron drift and to handle subscriptions whose renewal
  // date doesn't fall on the day we run.
  const minDays = 27.5;
  const maxDays = 32.5;
  const ms = (d: number) => d * 24 * 60 * 60 * 1000;
  const windowStart = new Date(now.getTime() + ms(minDays)).toISOString();
  const windowEnd = new Date(now.getTime() + ms(maxDays)).toISOString();
  return { windowStart, windowEnd };
}
