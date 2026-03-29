/**
 * Build tel/sms/mailto URLs for native OS handlers (Phone, Messages, Mail).
 * Phone values often come formatted; we normalize to a dialable string.
 */

/** Strip formatting; preserve leading + when present (E.164-style). */
export function normalizePhoneForLinking(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const leadingPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  return leadingPlus ? `+${digits}` : digits;
}

export function buildTelUrl(phone: string): string {
  const p = phone.trim();
  return `tel:${p}`;
}

/** Single-recipient SMS; optional body pre-fills the composer where the OS supports it. */
export function buildSmsUrl(phone: string, body?: string): string {
  const p = phone.trim();
  if (!body?.length) return `sms:${p}`;
  const q = new URLSearchParams({ body });
  return `sms:${p}?${q.toString()}`;
}

export function buildMailtoUrl(
  email: string,
  opts?: { subject?: string; body?: string },
): string {
  const addr = email.trim();
  const base = `mailto:${encodeURIComponent(addr)}`;
  const params = new URLSearchParams();
  if (opts?.subject) params.set("subject", opts.subject);
  if (opts?.body) params.set("body", opts.body);
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}
