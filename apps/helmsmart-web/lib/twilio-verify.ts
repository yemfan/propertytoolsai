/**
 * Twilio webhook signature verification.
 *
 * Twilio signs every webhook with an X-Twilio-Signature header (HMAC of the exact
 * public URL + sorted POST params, keyed by the account auth token). Verifying it
 * stops anyone who knows the URL from forging calls/texts and making us send SMS
 * to arbitrary numbers.
 *
 * OPT-IN: validation only runs when TWILIO_VALIDATE_WEBHOOK === "true". This is
 * deliberate — turning it on is a one-line env change you can test in preview
 * first, so a mis-derived public URL can't silently 403 live telephony in prod.
 * When the flag is off, verifyTwilioSignature returns true (trust, current
 * behaviour).
 */

import twilio from "twilio";
import type { NextRequest } from "next/server";

/**
 * Rebuild the exact public URL Twilio signed. Behind Vercel's proxy `req.url`
 * can be an internal deployment host, so prefer the forwarded headers (the
 * canonical https host the webhook is actually configured with).
 */
function publicUrl(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const { pathname, search } = req.nextUrl;
  return `${proto}://${host}${pathname}${search}`;
}

/**
 * @returns true when the request is trusted: a valid Twilio signature, or
 * validation is turned off. Returns false only when validation is on and the
 * signature is missing/invalid — callers should respond 403 in that case.
 */
export function verifyTwilioSignature(req: NextRequest, params: Record<string, string>): boolean {
  if (process.env.TWILIO_VALIDATE_WEBHOOK !== "true") return true;

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = req.headers.get("x-twilio-signature");
  if (!authToken || !signature) return false;

  try {
    return twilio.validateRequest(authToken, signature, publicUrl(req), params);
  } catch {
    return false;
  }
}

/** Collect all form fields into the plain object Twilio's validator needs (it
 *  hashes every param, not just the ones a route happens to read). */
export function formParams(formData: FormData): Record<string, string> {
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") params[key] = value;
  });
  return params;
}
