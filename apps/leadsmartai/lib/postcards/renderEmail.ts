import type { PostcardTemplate } from "./templates";

/**
 * Email wrapper around the postcard. Email clients can't render our
 * CSS keyframes or arbitrary JS, so the email is essentially a rich
 * teaser + "View your postcard" CTA linking to the animated public
 * page where the real experience lives.
 *
 * Kept intentionally small-footprint HTML — inline styles only, no
 * external assets beyond the agent's photo.
 */

type RenderInput = {
  template: PostcardTemplate;
  recipientName: string;
  personalMessage: string;
  publicUrl: string;
  agentName: string | null;
  agentPhotoUrl: string | null;
  brandName: string | null;
};

export function renderPostcardEmail(input: RenderInput): {
  subject: string;
  html: string;
  text: string;
} {
  const { template, recipientName, personalMessage, publicUrl } = input;
  const from =
    input.agentName && input.brandName
      ? `${input.agentName}, ${input.brandName}`
      : input.agentName || input.brandName || "Your agent";

  const subject = subjectFor(template.key, recipientName);

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f8fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(15,23,42,0.06);">
      <div style="padding:28px 28px 20px;text-align:center;background:linear-gradient(135deg,${template.accentColor}22,#ffffff);">
        <div style="font-size:48px;line-height:1;margin-bottom:8px;">${template.emojiBadge}</div>
        <div style="font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${template.accentColor};">You have a postcard from ${escapeHtml(from)}</div>
        <h1 style="margin:10px 0 0;font-size:24px;line-height:1.2;color:#0f172a;font-weight:700;">
          ${escapeHtml(template.title)}, ${escapeHtml(recipientName || "friend")}
        </h1>
      </div>
      <div style="padding:24px 28px;">
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;white-space:pre-line;">
${escapeHtml(personalMessage)}
        </p>
        <div style="text-align:center;margin:24px 0 8px;">
          <a href="${publicUrl}" style="display:inline-block;padding:14px 28px;border-radius:10px;background:${template.accentColor};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">
            View your postcard →
          </a>
        </div>
        <p style="margin:24px 0 0;text-align:center;font-size:12px;color:#94a3b8;">
          Tap the button to open the animated card.
        </p>
      </div>
    </div>
    <p style="text-align:center;margin:16px 0 0;font-size:11px;color:#94a3b8;">
      Sent by ${escapeHtml(from)} · Powered by LeadSmart AI
    </p>
  </div>
</body>
</html>`;

  const text = [
    `${template.title}, ${recipientName || "friend"}`,
    "",
    personalMessage,
    "",
    `View your postcard: ${publicUrl}`,
    "",
    `— ${from}`,
  ].join("\n");

  return { subject, html, text };
}

function subjectFor(key: string, recipient: string): string {
  const name = recipient?.trim() ? `, ${recipient.trim()}` : "";
  switch (key) {
    case "birthday":
      return `Happy birthday${name} 🎉`;
    case "anniversary":
      return `Happy home anniversary${name} 🏡`;
    case "holiday_seasonal":
      return `A little note for you${name}`;
    case "thinking_of_you":
    default:
      return `Thinking of you${name}`;
  }
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
