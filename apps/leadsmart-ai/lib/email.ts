type SendEmailParams = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail({ to, subject, text, html }: SendEmailParams) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log("sendEmail: RESEND_API_KEY not set, skipping email send");
    return;
  }

  const recipients = Array.isArray(to) ? to : [to];

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "LeadSmart AI <noreply@leadsmart-ai.com>",
      to: recipients,
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  });
}

