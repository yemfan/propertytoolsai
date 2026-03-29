type SendReportEmailInput = {
  to: string;
  name: string;
  address: string;
  reportUrl?: string;
};

export async function sendHomeValueReportEmail(input: SendReportEmailInput) {
  // Replace with Resend / SendGrid / Postmark later
  console.log("Send home value email:", input);

  return {
    success: true,
  };
}
