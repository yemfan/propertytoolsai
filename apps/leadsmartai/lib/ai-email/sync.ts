/**
 * Placeholder for Gmail API / Microsoft Graph sync (poll or webhook).
 * Wire provider credentials and call `process-inbound` with normalized payloads.
 */
export async function syncInboundEmailFromMailbox(): Promise<{ ok: boolean; message: string }> {
  return {
    ok: false,
    message: "Mailbox sync not configured. Use POST /api/ai-email/process-inbound or connect a provider.",
  };
}
