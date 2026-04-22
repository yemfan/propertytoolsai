import type { ListingActivitySnapshot, SellerCommentary, VisitorTimeline } from "./types";

/**
 * Pure renderer for the weekly seller-update email.
 * Input: activity snapshot + commentary block (either Claude-generated
 * or the fallback). Output: subject, html, text.
 */

const TIMELINE_LABEL: Record<VisitorTimeline, string> = {
  now: "Ready now",
  "3_6_months": "3-6 months",
  "6_12_months": "6-12 months",
  later: "Just exploring",
  just_looking: "Just curious",
};

type RenderInput = {
  activity: ListingActivitySnapshot;
  commentary: SellerCommentary;
  sellerFirstName: string | null;
  agentName: string | null;
  agentBrokerage: string | null;
};

export function renderSellerUpdateEmail(input: RenderInput): {
  subject: string;
  html: string;
  text: string;
} {
  const { activity, commentary } = input;
  const greeting = input.sellerFirstName ? `Hi ${input.sellerFirstName},` : "Hi,";

  const shortAddress = activity.propertyAddress.split(",")[0];
  const subject = commentary.suggestsPriceReduction
    ? `Weekly update — ${shortAddress} (let's talk pricing)`
    : activity.offersReceivedCount > 0
      ? `Weekly update — ${shortAddress} (${activity.offersReceivedCount} offer${activity.offersReceivedCount === 1 ? "" : "s"} in)`
      : `Weekly update — ${shortAddress}`;

  const dom = activity.daysOnMarket != null ? `${activity.daysOnMarket} days on market` : null;

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <h1 style="margin:0 0 4px 0;font-size:20px;">${greeting}</h1>
    <p style="margin:0 0 20px 0;color:#475569;font-size:14px;line-height:1.5;">
      Here's this week's activity on <strong>${escapeHtml(activity.propertyAddress)}</strong>${dom ? ` — ${escapeHtml(dom)}.` : "."}
    </p>

    ${renderCommentaryBlock(commentary)}

    <div style="margin-top:20px;padding:16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;">
      <h2 style="margin:0 0 12px 0;font-size:14px;color:#0f172a;">This week's numbers</h2>
      ${renderStatRow("Visitors", String(activity.visitorsTotal), activity.lifetimeVisitors > 0 ? `${activity.lifetimeVisitors} total since listing` : null)}
      ${renderStatRow("Open houses held", String(activity.openHousesHeldCount), null)}
      ${renderStatRow(
        "Offers received",
        String(activity.offersReceivedCount),
        activity.offerPriceRange
          ? activity.offerPriceRange.min === activity.offerPriceRange.max
            ? `At ${formatMoney(activity.offerPriceRange.max)}`
            : `${formatMoney(activity.offerPriceRange.min)} – ${formatMoney(activity.offerPriceRange.max)}`
          : null,
      )}
      ${activity.offersActiveCount > 0
        ? renderStatRow("Offers active", String(activity.offersActiveCount), null)
        : ""}
    </div>

    ${renderTimelineBreakdown(activity)}

    ${renderFooter(input)}
  </div>
</body></html>`;

  const text = renderText(input);

  return { subject, html, text };
}

function renderCommentaryBlock(c: SellerCommentary): string {
  const accent = c.suggestsPriceReduction ? "#d97706" : "#0ea5e9";
  const bg = c.suggestsPriceReduction ? "#fef3c7" : "#e0f2fe";
  const observations =
    c.observations.length > 0
      ? `<ul style="margin:8px 0 0 0;padding:0 0 0 20px;color:#334155;font-size:14px;line-height:1.7;">${c.observations
          .map((o) => `<li>${escapeHtml(o)}</li>`)
          .join("")}</ul>`
      : "";

  return `
    <div style="padding:16px 18px;background:${bg};border-left:4px solid ${accent};border-radius:10px;">
      <div style="font-size:14px;color:#0f172a;line-height:1.6;">
        ${escapeHtml(c.summary)}
      </div>
      ${observations}
      <div style="margin-top:12px;padding:10px 12px;background:rgba(255,255,255,0.7);border-radius:8px;">
        <span style="font-weight:600;color:#0f172a;">What I recommend:</span>
        <span style="color:#0f172a;"> ${escapeHtml(c.recommendation)}</span>
      </div>
    </div>`;
}

function renderStatRow(label: string, value: string, hint: string | null): string {
  return `
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:6px 0;border-top:1px solid #f1f5f9;font-size:14px;">
      <span style="color:#475569;">${escapeHtml(label)}</span>
      <span style="color:#0f172a;"><strong>${escapeHtml(value)}</strong>${hint ? ` <span style="color:#94a3b8;font-size:12px;">· ${escapeHtml(hint)}</span>` : ""}</span>
    </div>`;
}

function renderTimelineBreakdown(activity: ListingActivitySnapshot): string {
  const total = Object.values(activity.visitorTimelineBreakdown).reduce((a, b) => a + b, 0);
  if (total === 0) return "";
  const entries = (Object.entries(activity.visitorTimelineBreakdown) as Array<[VisitorTimeline, number]>)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  return `
    <div style="margin-top:20px;padding:16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;">
      <h2 style="margin:0 0 10px 0;font-size:14px;color:#0f172a;">Visitor buying timeline</h2>
      ${entries
        .map(
          ([timeline, count]) =>
            `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="color:#475569;">${escapeHtml(TIMELINE_LABEL[timeline])}</span><span style="color:#0f172a;font-weight:600;">${count}</span></div>`,
        )
        .join("")}
    </div>`;
}

function renderFooter(input: RenderInput): string {
  const sig = input.agentName
    ? `— ${input.agentName}${input.agentBrokerage ? `, ${input.agentBrokerage}` : ""}`
    : "— Your LeadSmart-powered agent";
  return `
    <div style="margin-top:20px;font-size:14px;color:#334155;line-height:1.6;">
      Happy to hop on a quick call if anything stands out.
    </div>
    <p style="margin-top:12px;color:#334155;font-size:14px;">${escapeHtml(sig)}</p>
    <p style="margin-top:24px;color:#94a3b8;font-size:11px;">
      Weekly update sent every Monday. Your agent can adjust frequency or turn this off.
    </p>`;
}

function renderText(input: RenderInput): string {
  const { activity, commentary } = input;
  const lines: string[] = [];
  lines.push(input.sellerFirstName ? `Hi ${input.sellerFirstName},` : "Hi,");
  lines.push("");
  lines.push(
    `Here's this week's activity on ${activity.propertyAddress}${
      activity.daysOnMarket != null ? ` — ${activity.daysOnMarket} days on market.` : "."
    }`,
  );
  lines.push("");
  lines.push(commentary.summary);
  if (commentary.observations.length > 0) {
    lines.push("");
    for (const o of commentary.observations) lines.push(`• ${o}`);
  }
  lines.push("");
  lines.push(`What I recommend: ${commentary.recommendation}`);
  lines.push("");
  lines.push("— This week's numbers —");
  lines.push(`Visitors: ${activity.visitorsTotal}`);
  lines.push(`Open houses held: ${activity.openHousesHeldCount}`);
  lines.push(`Offers received: ${activity.offersReceivedCount}`);
  if (activity.offerPriceRange) {
    lines.push(
      `Offer range: ${formatMoney(activity.offerPriceRange.min)} – ${formatMoney(activity.offerPriceRange.max)}`,
    );
  }
  lines.push("");
  if (input.agentName) {
    lines.push(
      `— ${input.agentName}${input.agentBrokerage ? `, ${input.agentBrokerage}` : ""}`,
    );
  }
  return lines.join("\n");
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
