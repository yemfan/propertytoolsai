import { supabaseBrowser } from "@/lib/supabaseBrowser";

/**
 * Sends Supabase recovery email. User must add `…/auth/reset-password` to Supabase
 * Auth → URL Configuration → Redirect URLs.
 */
export async function sendPasswordResetEmail(email: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmed = email.trim();
  if (!trimmed) {
    return { ok: false, message: "Enter your email address first." };
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const supabase = supabaseBrowser();
  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
    redirectTo: `${origin}/auth/reset-password`,
  });

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}
