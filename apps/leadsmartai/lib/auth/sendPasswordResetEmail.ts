import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { getOAuthRedirectOrigin } from "@/lib/siteUrl";

function formatResetPasswordError(raw: string): string {
  const msg = raw.trim() || "Could not send reset email.";
  if (/redirect|url|not allowed|invalid.*redirect/i.test(msg)) {
    return (
      `${msg} In Supabase → Authentication → URL Configuration, add Redirect URL ` +
      "`https://your-domain/auth/reset-password` (and `http://localhost:3000/auth/reset-password` for dev). " +
      "Set `NEXT_PUBLIC_SITE_URL` to your public `https://…` origin so the link matches production."
    );
  }
  if (/recovery|sending|email|smtp|mail/i.test(msg)) {
    return (
      `${msg} Check Supabase → Project Settings → Authentication: email templates enabled, ` +
      "custom SMTP if you use it, and project email rate limits. Confirm the user exists and signed up with email/password."
    );
  }
  return msg;
}

/**
 * Sends Supabase recovery email. Add `…/auth/reset-password` under Supabase → Authentication →
 * URL Configuration → Redirect URLs (same origin as {@link getOAuthRedirectOrigin}).
 */
export async function sendPasswordResetEmail(email: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmed = email.trim();
  if (!trimmed) {
    return { ok: false, message: "Enter your email address first." };
  }

  const origin = getOAuthRedirectOrigin();
  const supabase = supabaseBrowser();
  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
    redirectTo: `${origin}/auth/reset-password`,
  });

  if (error) {
    return { ok: false, message: formatResetPasswordError(error.message) };
  }
  return { ok: true };
}
