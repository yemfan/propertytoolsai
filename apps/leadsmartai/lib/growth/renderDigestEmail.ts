import type { GrowthOpportunity, OpportunityPriority } from "./opportunityTypes";

/**
 * Pure renderer for the weekly Growth & Opportunities digest email.
 * Input: up to 3 opportunities (priority-sorted + trimmed by caller).
 * Output: subject, html, text — ready to hand to sendEmail().
 *
 * Kept inline (no template engine) to stay consistent with the
 * transaction-overdue digest renderer in lib/transactions/overdueDigest.ts.
 */

const PRIORITY_EMOJI: Record<OpportunityPriority, string> = {
  high: "🔥",
  medium: "⚡",
  low: "💡",
};

const PRIORITY_COLOR: Record<OpportunityPriority, string> = {
  high: "#dc2626",
  medium: "#d97706",
  low: "#64748b",
};

export type DigestRenderInput = {
  opportunities: GrowthOpportunity[]; // caller pre-sorts + limits to top 3
  appBaseUrl: string;
  agentFirstName?: string | null;
};

export function renderGrowthDigestEmail(
  input: DigestRenderInput,
): { subject: string; html: string; text: string } {
  const greeting = input.agentFirstName ? `Hi ${input.agentFirstName},` : "Hi,";
  const count = input.opportunities.length;
  const topPriority = input.opportunities[0]?.priority ?? "medium";

  const subject =
    topPriority === "high"
      ? `${count} growth ${count === 1 ? "opportunity" : "opportunities"} for this week (1 urgent)`
      : `${count} growth ${count === 1 ? "opportunity" : "opportunities"} for this week`;

  const cards = input.opportunities
    .map((o) => renderCard(o, input.appBaseUrl))
    .join("");

  const dashboardUrl = `${input.appBaseUrl}/dashboard/growth`;

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <h1 style="margin:0 0 4px 0;font-size:20px;">${greeting}</h1>
    <p style="margin:0;color:#475569;font-size:14px;line-height:1.5;">
      Claude analyzed your pipeline over the weekend. Here are the top ${count} ${
        count === 1 ? "action" : "actions"
      } to take this week.
    </p>
    ${cards}
    <div style="margin-top:24px;padding:12px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;">
      <a href="${dashboardUrl}" style="color:#0f172a;text-decoration:none;font-weight:600;font-size:14px;">
        See all opportunities →
      </a>
      <div style="margin-top:2px;color:#64748b;font-size:12px;">
        Dashboard refreshes on demand with the latest data.
      </div>
    </div>
    <p style="margin-top:24px;color:#94a3b8;font-size:11px;line-height:1.5;">
      LeadSmart AI · Weekly Growth &amp; Opportunities digest. Turn off in
      Settings → Channels.
    </p>
  </div>
</body></html>`;

  const text = renderDigestText(input);
  return { subject, html, text };
}

function renderCard(o: GrowthOpportunity, appBaseUrl: string): string {
  const color = PRIORITY_COLOR[o.priority];
  const emoji = PRIORITY_EMOJI[o.priority];
  const actionHref = o.actionUrl
    ? o.actionUrl.startsWith("http")
      ? o.actionUrl
      : `${appBaseUrl}${o.actionUrl.startsWith("/") ? "" : "/"}${o.actionUrl}`
    : null;

  const contextChips =
    Array.isArray(o.context) && o.context.length > 0
      ? `<div style="margin-top:10px;">${o.context
          .slice(0, 3)
          .map(
            (c) =>
              `<span style="display:inline-block;margin-right:6px;margin-top:4px;padding:2px 8px;background:#f1f5f9;color:#334155;font-size:11px;border-radius:999px;">${escapeHtml(c)}</span>`,
          )
          .join("")}</div>`
      : "";

  const actionButton = actionHref
    ? `<a href="${escapeHtml(actionHref)}" style="display:inline-block;margin-top:12px;padding:8px 14px;background:#0f172a;color:#fff;font-size:13px;font-weight:600;border-radius:8px;text-decoration:none;">${escapeHtml(o.actionLabel ?? "Take action")} →</a>`
    : "";

  return `
    <div style="margin-top:16px;padding:16px;background:#fff;border:1px solid #e2e8f0;border-left:4px solid ${color};border-radius:8px;">
      <div style="font-size:11px;color:${color};font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">
        ${emoji} ${o.priority}
      </div>
      <div style="margin-top:4px;font-size:15px;font-weight:600;color:#0f172a;">
        ${escapeHtml(o.title)}
      </div>
      <div style="margin-top:6px;font-size:13px;color:#475569;line-height:1.5;">
        ${escapeHtml(o.insight)}
      </div>
      <div style="margin-top:8px;font-size:13px;color:#0f172a;line-height:1.5;">
        <span style="font-weight:600;">Action:</span> ${escapeHtml(o.action)}
      </div>
      ${contextChips}
      ${actionButton}
    </div>`;
}

function renderDigestText(input: DigestRenderInput): string {
  const lines: string[] = [];
  lines.push(
    `Top ${input.opportunities.length} growth ${
      input.opportunities.length === 1 ? "opportunity" : "opportunities"
    } this week:`,
  );
  for (const o of input.opportunities) {
    lines.push("");
    lines.push(`[${o.priority.toUpperCase()}] ${o.title}`);
    lines.push(o.insight);
    lines.push(`→ ${o.action}`);
    if (o.actionUrl) {
      const href = o.actionUrl.startsWith("http")
        ? o.actionUrl
        : `${input.appBaseUrl}${o.actionUrl.startsWith("/") ? "" : "/"}${o.actionUrl}`;
      lines.push(`   ${href}`);
    }
  }
  lines.push("");
  lines.push(`All opportunities: ${input.appBaseUrl}/dashboard/growth`);
  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sort + limit helper. Exported so the orchestrator (and tests) can
 * agree on what "top 3" means.
 */
export function selectTopOpportunities(
  opps: GrowthOpportunity[],
  limit: number = 3,
): GrowthOpportunity[] {
  const priorityOrder: Record<OpportunityPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  return [...opps]
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, limit);
}
