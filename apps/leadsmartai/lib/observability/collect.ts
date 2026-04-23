import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Cron + AI-feature observability aggregator.
 *
 * Each cron we ship writes to its own log table (transaction_nudge_log,
 * growth_digest_log, etc.) rather than a shared table. This module
 * queries each of those tables for the last N days and rolls up:
 *
 *   - sent / skipped / errored counts
 *   - last-run timestamp (most recent `created_at`)
 *   - sample error messages (up to 3 most recent)
 *   - top skip-reason buckets
 *
 * Also aggregates the two on-demand AI features (growth opportunities,
 * deal reviews) by counting cache rows written in the window — those
 * are per-agent-click rather than cron-triggered, so "sent count" is
 * really "Claude invocations."
 *
 * Missing tables degrade to empty rollups — support can open this page
 * even if a migration hasn't landed on a preview environment yet.
 */

export type JobHealth = {
  id: string;
  label: string;
  schedule: string; // human-readable crontab
  /** "cron" jobs fire on a schedule; "ondemand" fires when an agent clicks. */
  kind: "cron" | "ondemand";
  lastRunIso: string | null;
  sent: number;
  skipped: number;
  errored: number;
  sampleErrors: string[];
  topSkipReasons: Array<{ reason: string; count: number }>;
};

export type ObservabilityReport = {
  windowDays: number;
  jobs: JobHealth[];
};

const DEFAULT_WINDOW_DAYS = 7;

export async function collectObservability(
  opts?: { windowDays?: number },
): Promise<ObservabilityReport> {
  const windowDays = opts?.windowDays ?? DEFAULT_WINDOW_DAYS;
  const sinceIso = new Date(Date.now() - windowDays * 86_400_000).toISOString();

  const jobs = await Promise.all([
    rollupTransactionNudges(sinceIso),
    rollupWireFraudAlerts(sinceIso),
    rollupGrowthDigests(sinceIso),
    rollupSellerUpdates(sinceIso, windowDays),
    rollupOfferExpirations(sinceIso),
    rollupOpenHouseFollowups(sinceIso),
    rollupGrowthOpportunitiesOnDemand(sinceIso),
    rollupDealReviewsOnDemand(sinceIso),
  ]);

  return { windowDays, jobs };
}

// ── Cron log rollups ──────────────────────────────────────────────

async function rollupTransactionNudges(sinceIso: string): Promise<JobHealth> {
  return rollupGenericCronLog({
    id: "transactions-overdue-nudges",
    label: "Overdue transaction-task digest",
    schedule: "0 15 * * *  (daily 7am PT)",
    table: "transaction_nudge_log",
    sinceIso,
    fields: {
      emailSent: "email_sent",
      error: "error",
      skipReason: null, // this log doesn't carry skipped_reason strings; skipped = not sent AND not errored
    },
  });
}

async function rollupGrowthDigests(sinceIso: string): Promise<JobHealth> {
  return rollupGenericCronLog({
    id: "growth-weekly-digest",
    label: "Weekly Growth & Opportunities digest",
    schedule: "0 16 * * 1  (Mondays 9am PT)",
    table: "growth_digest_log",
    sinceIso,
    fields: {
      emailSent: "email_sent",
      error: "error",
      skipReason: "skipped_reason",
    },
  });
}

async function rollupOfferExpirations(sinceIso: string): Promise<JobHealth> {
  return rollupGenericCronLog({
    id: "offer-expirations",
    label: "Offer-expiration alerts (24h + 2h)",
    schedule: "15 */2 * * *  (every 2h at :15)",
    table: "offer_expiration_alert_log",
    sinceIso,
    fields: {
      emailSent: "email_sent",
      error: "error",
      skipReason: null,
    },
  });
}

async function rollupWireFraudAlerts(sinceIso: string): Promise<JobHealth> {
  // Wire-fraud log uses sms_sent as its "sent" column (SMS is the
  // primary channel); email is secondary. Count sms_sent as sent.
  try {
    const { data } = await supabaseAdmin
      .from("transaction_wire_alert_log")
      .select("sms_sent, error, created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(1000);
    return bucketize({
      id: "transactions-wire-fraud-alert",
      label: "Wire-fraud SMS alerts",
      schedule: "0 */6 * * *  (every 6 hours)",
      rows: (data ?? []) as Array<{
        sms_sent: boolean;
        error: string | null;
        created_at: string;
      }>,
      sentPredicate: (r) => Boolean((r as { sms_sent: boolean }).sms_sent),
      errorField: "error",
      skipReasonField: null,
    });
  } catch {
    return missingTableJob({
      id: "transactions-wire-fraud-alert",
      label: "Wire-fraud SMS alerts",
      schedule: "0 */6 * * *",
    });
  }
}

async function rollupSellerUpdates(
  sinceIso: string,
  windowDays: number,
): Promise<JobHealth> {
  // Seller updates don't have a log table; state lives on
  // transactions.seller_update_last_sent_at. Count rows where the
  // timestamp is within the window.
  try {
    const { count, data } = await supabaseAdmin
      .from("transactions")
      .select("seller_update_last_sent_at", { count: "exact" })
      .eq("seller_update_enabled", true)
      .in("transaction_type", ["listing_rep", "dual"])
      .gte("seller_update_last_sent_at", sinceIso)
      .order("seller_update_last_sent_at", { ascending: false })
      .limit(50);
    const rows = (data ?? []) as Array<{ seller_update_last_sent_at: string | null }>;
    const lastRunIso = rows[0]?.seller_update_last_sent_at ?? null;
    return {
      id: "seller-weekly-updates",
      label: "Weekly seller update emails",
      schedule: "0 17 * * 1  (Mondays 10am PT)",
      kind: "cron",
      lastRunIso,
      sent: count ?? 0,
      skipped: 0, // no skip signal stored for this job
      errored: 0, // no error storage for this job
      sampleErrors: [],
      topSkipReasons: [],
    };
  } catch {
    return missingTableJob({
      id: "seller-weekly-updates",
      label: "Weekly seller update emails",
      schedule: "0 17 * * 1",
    });
  }
}

async function rollupOpenHouseFollowups(sinceIso: string): Promise<JobHealth> {
  // Open-house follow-ups don't use a log table — state lives on
  // open_house_visitors.(thank_you_sent_at | check_in_sent_at).
  // Count rows where either was stamped in the window.
  try {
    const [thanks, checkIns] = await Promise.all([
      supabaseAdmin
        .from("open_house_visitors")
        .select("thank_you_sent_at", { count: "exact", head: true })
        .gte("thank_you_sent_at", sinceIso),
      supabaseAdmin
        .from("open_house_visitors")
        .select("check_in_sent_at", { count: "exact", head: true })
        .gte("check_in_sent_at", sinceIso),
    ]);

    const { data: latest } = await supabaseAdmin
      .from("open_house_visitors")
      .select("thank_you_sent_at, check_in_sent_at")
      .or(`thank_you_sent_at.gte.${sinceIso},check_in_sent_at.gte.${sinceIso}`)
      .order("thank_you_sent_at", { ascending: false, nullsFirst: false })
      .limit(1);
    const latestRow = (latest?.[0] ?? null) as
      | { thank_you_sent_at: string | null; check_in_sent_at: string | null }
      | null;
    const lastRunIso =
      [latestRow?.thank_you_sent_at, latestRow?.check_in_sent_at]
        .filter((v): v is string => Boolean(v))
        .sort()
        .pop() ?? null;

    return {
      id: "open-house-followups",
      label: "Open-house thank-you + check-in follow-ups",
      schedule: "30 * * * *  (hourly at :30)",
      kind: "cron",
      lastRunIso: lastRunIso ?? null,
      sent: (thanks.count ?? 0) + (checkIns.count ?? 0),
      skipped: 0,
      errored: 0,
      sampleErrors: [],
      topSkipReasons: [],
    };
  } catch {
    return missingTableJob({
      id: "open-house-followups",
      label: "Open-house thank-you + check-in follow-ups",
      schedule: "30 * * * *",
    });
  }
}

// ── On-demand AI feature rollups ──────────────────────────────────

async function rollupGrowthOpportunitiesOnDemand(
  sinceIso: string,
): Promise<JobHealth> {
  try {
    const { count, data } = await supabaseAdmin
      .from("growth_opportunities_cache")
      .select("generated_at", { count: "exact" })
      .gte("generated_at", sinceIso)
      .order("generated_at", { ascending: false })
      .limit(1);
    const lastRunIso =
      (data as Array<{ generated_at: string }> | null)?.[0]?.generated_at ?? null;
    return {
      id: "growth-opportunities-ondemand",
      label: "Growth & Opportunities AI calls",
      schedule: "on-demand (cached 1h per agent)",
      kind: "ondemand",
      lastRunIso,
      sent: count ?? 0,
      skipped: 0,
      errored: 0,
      sampleErrors: [],
      topSkipReasons: [],
    };
  } catch {
    return missingTableJob({
      id: "growth-opportunities-ondemand",
      label: "Growth & Opportunities AI calls",
      schedule: "on-demand",
      kind: "ondemand",
    });
  }
}

async function rollupDealReviewsOnDemand(sinceIso: string): Promise<JobHealth> {
  try {
    const { count, data } = await supabaseAdmin
      .from("transaction_reviews")
      .select("generated_at", { count: "exact" })
      .gte("generated_at", sinceIso)
      .order("generated_at", { ascending: false })
      .limit(1);
    const lastRunIso =
      (data as Array<{ generated_at: string }> | null)?.[0]?.generated_at ?? null;
    return {
      id: "deal-reviews-ondemand",
      label: "AI deal reviews (post-close debrief)",
      schedule: "on-demand (cached per transaction)",
      kind: "ondemand",
      lastRunIso,
      sent: count ?? 0,
      skipped: 0,
      errored: 0,
      sampleErrors: [],
      topSkipReasons: [],
    };
  } catch {
    return missingTableJob({
      id: "deal-reviews-ondemand",
      label: "AI deal reviews (post-close debrief)",
      schedule: "on-demand",
      kind: "ondemand",
    });
  }
}

// ── Shared helpers ────────────────────────────────────────────────

async function rollupGenericCronLog(opts: {
  id: string;
  label: string;
  schedule: string;
  table: string;
  sinceIso: string;
  fields: {
    emailSent: string;
    error: string;
    skipReason: string | null;
  };
}): Promise<JobHealth> {
  try {
    const selectCols = [opts.fields.emailSent, opts.fields.error, "created_at"];
    if (opts.fields.skipReason) selectCols.push(opts.fields.skipReason);
    const { data } = await supabaseAdmin
      .from(opts.table)
      .select(selectCols.join(","))
      .gte("created_at", opts.sinceIso)
      .order("created_at", { ascending: false })
      .limit(1000);
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    return bucketize({
      id: opts.id,
      label: opts.label,
      schedule: opts.schedule,
      rows: rows as unknown as Array<{
        email_sent: boolean;
        error: string | null;
        created_at: string;
        skipped_reason?: string | null;
      }>,
      sentPredicate: (r) => Boolean((r as { email_sent: boolean }).email_sent),
      errorField: "error",
      skipReasonField: opts.fields.skipReason,
    });
  } catch {
    return missingTableJob({
      id: opts.id,
      label: opts.label,
      schedule: opts.schedule,
    });
  }
}

function bucketize(opts: {
  id: string;
  label: string;
  schedule: string;
  rows: Array<{
    error: string | null;
    created_at: string;
    skipped_reason?: string | null;
    [k: string]: unknown;
  }>;
  sentPredicate: (r: Record<string, unknown>) => boolean;
  errorField: string;
  skipReasonField: string | null;
}): JobHealth {
  const { rows } = opts;
  let sent = 0;
  let skipped = 0;
  let errored = 0;
  const errorSamples: string[] = [];
  const skipReasonCounts = new Map<string, number>();

  for (const r of rows) {
    if (r.error) {
      errored += 1;
      if (errorSamples.length < 3) errorSamples.push(String(r.error));
    } else if (opts.sentPredicate(r as Record<string, unknown>)) {
      sent += 1;
    } else {
      skipped += 1;
      const reason = opts.skipReasonField
        ? (r[opts.skipReasonField] as string | null)
        : null;
      const key = reason ?? "(unspecified)";
      skipReasonCounts.set(key, (skipReasonCounts.get(key) ?? 0) + 1);
    }
  }

  const topSkipReasons = [...skipReasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return {
    id: opts.id,
    label: opts.label,
    schedule: opts.schedule,
    kind: "cron",
    lastRunIso: rows[0]?.created_at ?? null,
    sent,
    skipped,
    errored,
    sampleErrors: errorSamples,
    topSkipReasons,
  };
}

function missingTableJob(opts: {
  id: string;
  label: string;
  schedule: string;
  kind?: "cron" | "ondemand";
}): JobHealth {
  return {
    id: opts.id,
    label: opts.label,
    schedule: opts.schedule,
    kind: opts.kind ?? "cron",
    lastRunIso: null,
    sent: 0,
    skipped: 0,
    errored: 0,
    sampleErrors: [],
    topSkipReasons: [],
  };
}
