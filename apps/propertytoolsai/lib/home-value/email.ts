import { sendEmail } from "@/lib/email";

type SendReportEmailInput = {
  to: string;
  name: string;
  address: string;
  reportUrl?: string;
};

export async function sendHomeValueReportEmail(input: SendReportEmailInput) {
  const firstName = input.name.trim().split(/\s+/)[0] || "there";
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.propertytoolsai.com").replace(/\/$/, "");
  const reportLink = input.reportUrl ? `${siteUrl}${input.reportUrl}` : siteUrl;

  const subject = `Your Home Value Report — ${input.address}`;

  const text = [
    `Hi ${firstName},`,
    "",
    `Thanks for using PropertyTools AI! Here's your home value report for ${input.address}.`,
    "",
    `View your full report: ${reportLink}`,
    "",
    "What's included:",
    "• Estimated value range with confidence score",
    "• Local market benchmarks and comparable sales",
    "• Next-step recommendations based on your situation",
    "",
    "Questions? Reply to this email or visit propertytoolsai.com.",
    "",
    "— PropertyTools AI",
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:32px;">
      <h1 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 8px;">Your Home Value Report</h1>
      <p style="font-size:14px;color:#64748b;margin:0 0 24px;">${input.address}</p>

      <p style="font-size:15px;color:#334155;line-height:1.6;margin:0 0 20px;">
        Hi ${firstName}, thanks for using PropertyTools AI! Your detailed valuation report is ready.
      </p>

      <a href="${reportLink}" style="display:inline-block;background:#0f172a;color:#fff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:10px;text-decoration:none;">
        View Full Report
      </a>

      <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0;">
        <p style="font-size:13px;font-weight:600;color:#334155;margin:0 0 8px;">What's in your report:</p>
        <ul style="font-size:13px;color:#64748b;line-height:1.8;margin:0;padding-left:18px;">
          <li>Estimated value range with confidence score</li>
          <li>Local market benchmarks and comparable sales</li>
          <li>Next-step recommendations for your situation</li>
        </ul>
      </div>
    </div>

    <p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:24px;">
      PropertyTools AI &middot; <a href="${siteUrl}" style="color:#94a3b8;">propertytoolsai.com</a>
    </p>
  </div>
</body>
</html>`.trim();

  await sendEmail({ to: input.to, subject, text, html });

  return { success: true };
}
