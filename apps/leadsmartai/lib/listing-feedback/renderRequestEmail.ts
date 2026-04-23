/**
 * Pure renderer for the feedback-request email sent by a listing agent
 * to a buyer-rep agent after a showing.
 *
 * Tone: peer-to-peer, industry-standard. The recipient is a fellow
 * agent — no marketing pitch, just the ask + the form link.
 */

export type FeedbackRequestInput = {
  buyerAgentName: string | null;
  propertyAddress: string;
  city: string | null;
  state: string | null;
  showingDate: string | null;
  formUrl: string;
  listingAgentName: string | null;
  brokerage: string | null;
};

export function renderFeedbackRequestEmail(input: FeedbackRequestInput): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = input.buyerAgentName ? `Hi ${input.buyerAgentName},` : "Hi,";
  const signoff = input.listingAgentName
    ? `— ${input.listingAgentName}${input.brokerage ? `, ${input.brokerage}` : ""}`
    : "— Listing agent";
  const locationLine = [input.city, input.state].filter(Boolean).join(", ");
  const showingLine = input.showingDate
    ? `Your client viewed ${input.propertyAddress} on ${formatDate(input.showingDate)}.`
    : `Your client recently viewed ${input.propertyAddress}.`;

  const subject = `Quick feedback request — ${input.propertyAddress}`;

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <h1 style="margin:0 0 4px 0;font-size:20px;">${escapeHtml(greeting)}</h1>
    <p style="margin:0;color:#334155;font-size:14px;line-height:1.6;">
      ${escapeHtml(showingLine)}${locationLine ? ` (${escapeHtml(locationLine)})` : ""}
    </p>
    <p style="margin-top:14px;color:#334155;font-size:14px;line-height:1.6;">
      Would you mind sharing a quick note on how your buyer felt about the home?
      Pricing, condition, whether they're considering an offer — whatever's fair
      game. Takes 30 seconds.
    </p>
    <div style="margin-top:18px;">
      <a href="${escapeHtml(input.formUrl)}"
         style="display:inline-block;padding:12px 20px;background:#0f172a;color:#fff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;">
        Share feedback →
      </a>
    </div>
    <p style="margin-top:20px;color:#475569;font-size:14px;">${escapeHtml(signoff)}</p>
    <p style="margin-top:24px;color:#94a3b8;font-size:11px;line-height:1.5;">
      The link opens a one-page form — no login needed. LeadSmart AI handles the routing.
    </p>
  </div>
</body></html>`;

  const text = [
    greeting,
    "",
    showingLine + (locationLine ? ` (${locationLine})` : ""),
    "",
    "Would you mind sharing a quick note on how your buyer felt about the home? Pricing, condition, whether they're considering an offer — whatever's fair game. Takes 30 seconds.",
    "",
    `Feedback form: ${input.formUrl}`,
    "",
    signoff,
  ].join("\n");

  return { subject, html, text };
}

function formatDate(iso: string): string {
  // YYYY-MM-DD inputs are floating dates (the showing day), not UTC
  // instants. Force UTC rendering so a PT test run doesn't shift
  // "2026-05-15" to May 14.
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
