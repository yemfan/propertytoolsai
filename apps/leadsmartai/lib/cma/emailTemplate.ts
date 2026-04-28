import { buildListingStrategyBands } from "./listingStrategy";
import type { CmaSnapshot } from "./types";

/**
 * Pure email-template helpers for the seller-facing CMA email.
 *
 * Lives in its own file (no `server-only`) so the wording can be
 * unit-tested without spinning up a Resend mock. The orchestrator
 * (sendCmaEmail.ts) calls these to render the final HTML + text bodies.
 */

export type CmaEmailContext = {
  /** What the agent typed into the cover-note textarea. May be empty. */
  agentMessage: string;
  /** Display name on the FROM line — e.g. "Sam Reynolds" or
   *  "Sam at Pacific Realty". Falls back to "your agent" when
   *  the agent has no first_name set. */
  agentDisplayName: string;
  /** Seller's first name when known (from contact row). Used for
   *  greeting personalization. */
  sellerFirstName: string | null;
  /** Free-text title or the subject address. */
  cmaTitle: string;
  snapshot: CmaSnapshot;
};

export type CmaEmailRendered = {
  subject: string;
  text: string;
  html: string;
};

export function renderCmaEmail(ctx: CmaEmailContext): CmaEmailRendered {
  const greeting = ctx.sellerFirstName?.trim()
    ? `Hi ${ctx.sellerFirstName.trim()},`
    : "Hi there,";

  const subject = `Comparative Market Analysis — ${ctx.snapshot.subject.address || ctx.cmaTitle}`;

  const valueLine = `Estimated value range: ${formatMoney(ctx.snapshot.valuation.low)} – ${formatMoney(ctx.snapshot.valuation.high)} (mid ${formatMoney(ctx.snapshot.valuation.estimatedValue)}).`;
  const compsLine = `Built from ${ctx.snapshot.comps.length} comparable sale${ctx.snapshot.comps.length === 1 ? "" : "s"} within ~3 miles in the last ~12 months.`;

  const bands = buildListingStrategyBands(
    ctx.snapshot.strategies,
    ctx.snapshot.valuation,
  );

  // Plain-text body — for clients that don't render HTML.
  const textParts: string[] = [
    greeting,
    "",
    ctx.agentMessage.trim() ||
      `I put together a quick CMA for ${ctx.snapshot.subject.address || "your property"}. The full report is attached as a PDF; here's the headline:`,
    "",
    valueLine,
    compsLine,
    "",
    "Listing strategy options:",
    ...bands.map((b) => {
      const dom = b.expectedDom != null ? ` · ~${b.expectedDom} days` : "";
      return `  • ${b.label}: ${formatMoney(b.price)}${dom}`;
    }),
    "",
    "Happy to walk through the comps and the strategy on a call.",
    "",
    `— ${ctx.agentDisplayName}`,
  ];

  // HTML body — modest styling, all inline so it survives Gmail/Outlook
  // sanitization. No external CSS, no remote images.
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;font-size:15px;line-height:1.5;max-width:560px;">
  <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
  <p style="margin:0 0 14px;white-space:pre-wrap;">${escapeHtml(
    ctx.agentMessage.trim() ||
      `I put together a quick CMA for ${ctx.snapshot.subject.address || "your property"}. The full report is attached as a PDF; here's the headline:`,
  )}</p>

  <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;background:#f8fafc;margin:14px 0;">
    <div style="font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#64748b;">Estimated value</div>
    <div style="font-size:22px;font-weight:700;color:#047857;margin-top:4px;">${escapeHtml(formatMoney(ctx.snapshot.valuation.estimatedValue))}</div>
    <div style="font-size:13px;color:#475569;margin-top:2px;">Range: ${escapeHtml(formatMoney(ctx.snapshot.valuation.low))} – ${escapeHtml(formatMoney(ctx.snapshot.valuation.high))}</div>
    <div style="font-size:12px;color:#94a3b8;margin-top:6px;">${escapeHtml(compsLine)}</div>
  </div>

  <div style="font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#475569;margin:16px 0 6px;">Listing strategies</div>
  <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
    ${bands
      .map(
        (b) => `<tr>
      <td style="padding:6px 0;font-size:13px;color:#334155;width:auto;">
        <strong>${escapeHtml(b.label)}</strong>${
          b.expectedDom != null
            ? ` <span style="color:#94a3b8;font-weight:normal;">· ~${b.expectedDom}d</span>`
            : ""
        }
        <div style="font-size:11px;color:#64748b;font-weight:normal;margin-top:2px;">${escapeHtml(b.rationale)}</div>
      </td>
      <td style="padding:6px 0;font-size:14px;font-weight:700;color:#0f172a;text-align:right;white-space:nowrap;">${escapeHtml(formatMoney(b.price))}</td>
    </tr>`,
      )
      .join("")}
  </table>

  <p style="margin:18px 0 4px;color:#475569;font-size:13px;">The full report (subject snapshot, all comps, methodology) is attached as a PDF.</p>
  <p style="margin:18px 0 0;font-weight:600;">— ${escapeHtml(ctx.agentDisplayName)}</p>
</div>`;

  return {
    subject,
    text: textParts.join("\n"),
    html,
  };
}

function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
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
