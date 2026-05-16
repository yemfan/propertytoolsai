import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendAnnualRenewalReminderEmail } from "@/lib/email/annualRenewalReminder";
import { renewalReminderWindow } from "@/lib/billing/renewalWindow";
import type { PlanSlug } from "@/lib/billing/plans";

export { renewalReminderWindow };

type DueRow = {
  id: string;
  user_id: string;
  plan: string;
  current_period_end: string;
};

type ProfileRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
};

function isPlanSlug(v: string): v is PlanSlug {
  return (
    v === "starter" ||
    v === "pro" ||
    v === "premium" ||
    v === "signature" ||
    v === "team"
  );
}

/**
 * Find all annual subscriptions due to renew in ~30 days that haven't
 * had a reminder sent for the current period, then email each one.
 *
 * Idempotent: setting `annual_renewal_reminder_sent_at` after each
 * send means re-running the cron in the same window is a no-op. The
 * webhook handler clears the column when a successful renewal
 * advances `current_period_end`, so the next period gets its own
 * reminder.
 *
 * Returns a summary so the cron handler can surface counts in logs.
 */
export async function sendDueRenewalReminders(
  now: Date = new Date(),
): Promise<{ scanned: number; sent: number; skipped: number; errors: number }> {
  const { windowStart, windowEnd } = renewalReminderWindow(now);

  const { data: dueRows, error: dueErr } = await supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, plan, current_period_end")
    .eq("billing_cadence", "annual")
    .is("annual_renewal_reminder_sent_at", null)
    .in("status", ["active", "trialing"])
    .gte("current_period_end", windowStart)
    .lt("current_period_end", windowEnd)
    .limit(500);

  if (dueErr) throw dueErr;
  const due = (dueRows ?? []) as DueRow[];

  if (due.length === 0) {
    return { scanned: 0, sent: 0, skipped: 0, errors: 0 };
  }

  const userIds = Array.from(new Set(due.map((r) => r.user_id)));
  const { data: profileRows, error: profileErr } = await supabaseAdmin
    .from("user_profiles")
    .select("user_id, email, full_name")
    .in("user_id", userIds);

  if (profileErr) throw profileErr;
  const byUser = new Map<string, ProfileRow>();
  for (const p of (profileRows ?? []) as ProfileRow[]) {
    byUser.set(p.user_id, p);
  }

  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const nowIso = now.toISOString();

  for (const row of due) {
    const profile = byUser.get(row.user_id);
    if (!profile?.email) {
      skipped += 1;
      continue;
    }
    if (!isPlanSlug(row.plan)) {
      skipped += 1;
      continue;
    }

    try {
      await sendAnnualRenewalReminderEmail({
        to: profile.email,
        firstName: profile.full_name ?? profile.email,
        planSlug: row.plan,
        renewalDateIso: row.current_period_end,
      });

      const { error: updErr } = await supabaseAdmin
        .from("subscriptions")
        .update({ annual_renewal_reminder_sent_at: nowIso })
        .eq("id", row.id);
      if (updErr) throw updErr;

      sent += 1;
    } catch (e) {
      console.error("[annual-renewal-reminder] failed for row", row.id, e);
      errors += 1;
    }
  }

  return { scanned: due.length, sent, skipped, errors };
}
