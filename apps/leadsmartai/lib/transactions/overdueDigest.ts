/**
 * Daily "overdue + upcoming transaction tasks" digest builder.
 *
 * Pure functions here so the cron route stays thin and so the digest
 * content is unit-testable without mocking Supabase or Resend. The
 * route calls `collectDigestInputs()` (which DOES hit the DB) then
 * passes the raw rows into `buildAgentDigest()` (pure).
 *
 * Design notes:
 *
 *   * Day-granularity is correct for real-estate deadlines. Time-of-day
 *     precision is false precision — CAR contracts say "within N days",
 *     not "by 5pm". We compare on calendar dates.
 *
 *   * "Upcoming" horizon is 72 hours. Long enough to give an agent time
 *     to chase a stuck counterparty; short enough to keep the email
 *     from turning into 20-line noise.
 *
 *   * Wire-verification (seed_key = 'verify_wire_instructions') is
 *     singled out because it's the highest-risk single task in the
 *     whole pipeline — wire fraud losses average $50-200k per incident
 *     and the window is narrow. Agents who read fast should still see it.
 *
 *   * We include NEWLY overdue (due yesterday or today but not yet
 *     completed) AND anything still open from the past 14 days. Beyond
 *     14 days we assume the agent either dealt with it out-of-band or
 *     abandoned the deal; we'd rather stop nagging than spam stale
 *     rows forever.
 */

import type {
  TransactionRow,
  TransactionTaskRow,
} from "./types";

/** Inputs the DB layer hands to the pure digest builder. */
export type DigestInputs = {
  /** ISO date like "2026-04-22" — treated as "today" in the agent's view. */
  todayIso: string;
  /** Active transactions for one agent. */
  transactions: Array<TransactionRow & { contact_name: string | null }>;
  /** All incomplete tasks across those transactions. */
  tasks: TransactionTaskRow[];
};

export type DigestTask = {
  id: string;
  title: string;
  description: string | null;
  stage: TransactionTaskRow["stage"];
  dueDate: string; // ISO date
  daysFromToday: number; // negative = overdue
  isWireVerification: boolean;
};

export type DigestTransactionGroup = {
  transactionId: string;
  propertyAddress: string;
  contactName: string | null;
  mutualAcceptanceDate: string | null;
  closingDate: string | null;
  overdue: DigestTask[];
  upcoming: DigestTask[];
};

export type AgentDigest = {
  /** No groups means "nothing to send — skip." */
  groups: DigestTransactionGroup[];
  taskCount: number;
  overdueCount: number;
  upcomingCount: number;
  /** True if any overdue task is a wire-verification task. Drives the
      red warning banner at the top of the email. */
  hasWireVerificationOverdue: boolean;
};

const UPCOMING_HORIZON_DAYS = 3;
const OVERDUE_LOOKBACK_DAYS = 14;
const WIRE_VERIFICATION_SEED_KEY = "verify_wire_instructions";

export function buildAgentDigest(input: DigestInputs): AgentDigest {
  const today = parseIsoDate(input.todayIso);
  const txById = new Map(input.transactions.map((t) => [t.id, t]));

  const overdueCutoff = addDaysToDate(today, -OVERDUE_LOOKBACK_DAYS);
  const upcomingCutoff = addDaysToDate(today, UPCOMING_HORIZON_DAYS);

  const groupsById = new Map<string, DigestTransactionGroup>();

  for (const task of input.tasks) {
    if (task.completed_at) continue;
    if (!task.due_date) continue;
    const due = parseIsoDate(task.due_date);
    if (due < overdueCutoff) continue; // too stale — stop nagging
    if (due > upcomingCutoff) continue; // too far out

    const tx = txById.get(task.transaction_id);
    if (!tx) continue;
    if (tx.status !== "active") continue;

    const daysFromToday = daysBetween(today, due);
    const isOverdue = daysFromToday < 0;

    const digestTask: DigestTask = {
      id: task.id,
      title: task.title,
      description: task.description,
      stage: task.stage,
      dueDate: task.due_date,
      daysFromToday,
      isWireVerification: task.seed_key === WIRE_VERIFICATION_SEED_KEY,
    };

    let group = groupsById.get(tx.id);
    if (!group) {
      group = {
        transactionId: tx.id,
        propertyAddress: tx.property_address,
        contactName: tx.contact_name,
        mutualAcceptanceDate: tx.mutual_acceptance_date,
        closingDate: tx.closing_date,
        overdue: [],
        upcoming: [],
      };
      groupsById.set(tx.id, group);
    }
    if (isOverdue) group.overdue.push(digestTask);
    else group.upcoming.push(digestTask);
  }

  // Sort tasks within each group: overdue by most-overdue first; upcoming
  // by soonest first. Then sort groups: transactions with overdue tasks
  // first, then by earliest upcoming deadline.
  const groups = [...groupsById.values()].map((g) => ({
    ...g,
    overdue: [...g.overdue].sort((a, b) => a.daysFromToday - b.daysFromToday),
    upcoming: [...g.upcoming].sort((a, b) => a.daysFromToday - b.daysFromToday),
  }));
  groups.sort((a, b) => {
    if (a.overdue.length && !b.overdue.length) return -1;
    if (!a.overdue.length && b.overdue.length) return 1;
    const aFirst = a.overdue[0] ?? a.upcoming[0];
    const bFirst = b.overdue[0] ?? b.upcoming[0];
    return (aFirst?.daysFromToday ?? 0) - (bFirst?.daysFromToday ?? 0);
  });

  let overdueCount = 0;
  let upcomingCount = 0;
  let hasWireVerificationOverdue = false;
  for (const g of groups) {
    overdueCount += g.overdue.length;
    upcomingCount += g.upcoming.length;
    if (g.overdue.some((t) => t.isWireVerification)) {
      hasWireVerificationOverdue = true;
    }
  }

  return {
    groups,
    taskCount: overdueCount + upcomingCount,
    overdueCount,
    upcomingCount,
    hasWireVerificationOverdue,
  };
}

/**
 * Renders an agent-facing HTML email for the digest. Kept inline (no
 * template engine) because the structure is tiny and bringing a
 * template engine in would be over-engineering.
 */
export function renderDigestEmail(digest: AgentDigest, opts: {
  appBaseUrl: string;
  agentFirstName?: string | null;
}): { subject: string; html: string; text: string } {
  const greeting = opts.agentFirstName ? `Hi ${opts.agentFirstName},` : "Hi,";
  const summaryLine =
    digest.overdueCount > 0 && digest.upcomingCount > 0
      ? `You have <strong>${digest.overdueCount} overdue</strong> and ${digest.upcomingCount} upcoming transaction task${digest.upcomingCount === 1 ? "" : "s"}.`
      : digest.overdueCount > 0
        ? `You have <strong>${digest.overdueCount} overdue</strong> transaction task${digest.overdueCount === 1 ? "" : "s"}.`
        : `You have ${digest.upcomingCount} upcoming transaction task${digest.upcomingCount === 1 ? "" : "s"} in the next 72 hours.`;

  const subject =
    digest.hasWireVerificationOverdue
      ? `⚠️ Wire verification overdue — ${digest.overdueCount} task${digest.overdueCount === 1 ? "" : "s"} overdue`
      : digest.overdueCount > 0
        ? `${digest.overdueCount} transaction task${digest.overdueCount === 1 ? "" : "s"} overdue`
        : `${digest.upcomingCount} deadline${digest.upcomingCount === 1 ? "" : "s"} this week`;

  const wireBanner = digest.hasWireVerificationOverdue
    ? `<div style="margin:16px 0;padding:12px 16px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:6px;">
        <div style="font-weight:600;color:#991b1b;font-size:14px;">⚠️ Wire-verification is overdue</div>
        <div style="margin-top:4px;color:#7f1d1d;font-size:13px;line-height:1.5;">
          Call your title company on a <strong>known phone number</strong> (not the one in an email).
          Wire fraud is the #1 closing-phase risk — fraudsters impersonate title companies and redirect funds.
          Never rely solely on emailed instructions.
        </div>
      </div>`
    : "";

  const groupsHtml = digest.groups
    .map((g) => renderGroup(g, opts.appBaseUrl))
    .join("");

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <h1 style="margin:0 0 4px 0;font-size:20px;">${greeting}</h1>
    <p style="margin:0;color:#475569;font-size:14px;line-height:1.5;">${summaryLine}</p>
    ${wireBanner}
    ${groupsHtml}
    <p style="margin-top:24px;color:#94a3b8;font-size:11px;line-height:1.5;">
      LeadSmart AI — Transaction Coordinator nudges. Only deals with incomplete tasks due in the next 72 hours or
      overdue within the last 14 days are included. Mark tasks complete to stop seeing them.
    </p>
  </div>
</body></html>`;

  const text = renderDigestText(digest, opts);

  return { subject, html, text };
}

function renderGroup(g: DigestTransactionGroup, appBaseUrl: string): string {
  const url = `${appBaseUrl}/dashboard/transactions/${g.transactionId}`;
  const header = `
    <div style="margin-top:20px;padding:12px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;">
      <a href="${url}" style="color:#0f172a;text-decoration:none;font-weight:600;font-size:15px;">
        ${escapeHtml(g.propertyAddress)}
      </a>
      <div style="margin-top:2px;color:#64748b;font-size:12px;">
        ${g.contactName ? escapeHtml(g.contactName) : "—"}
        ${g.closingDate ? ` · closing ${escapeHtml(g.closingDate)}` : ""}
      </div>`;

  const overdueRows = g.overdue
    .map((t) => renderTaskRow(t, "overdue"))
    .join("");
  const upcomingRows = g.upcoming
    .map((t) => renderTaskRow(t, "upcoming"))
    .join("");

  return `${header}
    ${overdueRows ? `<div style="margin-top:10px;font-size:11px;font-weight:600;color:#dc2626;text-transform:uppercase;letter-spacing:0.04em;">Overdue</div>${overdueRows}` : ""}
    ${upcomingRows ? `<div style="margin-top:10px;font-size:11px;font-weight:600;color:#334155;text-transform:uppercase;letter-spacing:0.04em;">Upcoming</div>${upcomingRows}` : ""}
    </div>`;
}

function renderTaskRow(t: DigestTask, kind: "overdue" | "upcoming"): string {
  const color = kind === "overdue" ? "#dc2626" : "#0f172a";
  const label =
    t.daysFromToday === 0
      ? "Today"
      : t.daysFromToday < 0
        ? `${Math.abs(t.daysFromToday)}d overdue`
        : `in ${t.daysFromToday}d`;
  return `<div style="margin-top:6px;padding:8px 10px;background:${kind === "overdue" ? "#fef2f2" : "#f8fafc"};border-radius:6px;display:flex;justify-content:space-between;gap:8px;">
    <div style="font-size:13px;color:${color};line-height:1.4;">${escapeHtml(t.title)}</div>
    <div style="font-size:11px;color:${color};white-space:nowrap;">${label}</div>
  </div>`;
}

function renderDigestText(digest: AgentDigest, opts: { appBaseUrl: string }): string {
  const lines: string[] = [];
  lines.push(
    digest.overdueCount > 0
      ? `${digest.overdueCount} overdue, ${digest.upcomingCount} upcoming`
      : `${digest.upcomingCount} upcoming in the next 72h`,
  );
  if (digest.hasWireVerificationOverdue) {
    lines.push("");
    lines.push("⚠️ WIRE VERIFICATION OVERDUE — call your title company on a known phone number. Wire fraud is the #1 closing-phase risk.");
  }
  for (const g of digest.groups) {
    lines.push("");
    lines.push(`— ${g.propertyAddress}${g.contactName ? ` (${g.contactName})` : ""}`);
    lines.push(`  ${opts.appBaseUrl}/dashboard/transactions/${g.transactionId}`);
    for (const t of g.overdue) {
      const dlabel = t.daysFromToday === 0 ? "today" : `${Math.abs(t.daysFromToday)}d overdue`;
      lines.push(`  [!] ${t.title} — ${dlabel}`);
    }
    for (const t of g.upcoming) {
      const dlabel = t.daysFromToday === 0 ? "today" : `in ${t.daysFromToday}d`;
      lines.push(`  [ ] ${t.title} — ${dlabel}`);
    }
  }
  return lines.join("\n");
}

// ── Date helpers (UTC, no time component) ─────────────────────────────

function parseIsoDate(iso: string): Date {
  // "YYYY-MM-DD" → midnight UTC
  const [y, m, d] = iso.split("-").map((v) => Number(v));
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

function addDaysToDate(d: Date, days: number): Date {
  const copy = new Date(d.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
