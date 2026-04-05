import type { User } from "@supabase/supabase-js";
import { fullNameFromUserMetadata } from "@/lib/auth/canonicalUserContact";
import { isSupabaseServiceConfigured, supabaseAdmin } from "@/lib/supabase/admin";

export type OAuthSignupOriginApp = "propertytools" | "leadsmart";

/**
 * Ensures `user_profiles`, `leadsmart_users`, and `propertytools_users` exist after OAuth.
 * Email/password signup already upserts these client-side; OAuth previously did not, so the
 * dashboard proxy could redirect to login when `user_profiles` was missing.
 */
export async function ensureSharedUserTablesAfterOAuth(
  user: User,
  signupOriginApp: OAuthSignupOriginApp
): Promise<void> {
  if (!isSupabaseServiceConfigured()) {
    console.error(
      "[ensureSharedUserTablesAfterOAuth] SUPABASE_SERVICE_ROLE_KEY is not set; cannot bootstrap profile rows"
    );
    return;
  }

  const uid = user.id;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName =
    (fullNameFromUserMetadata(meta) ?? user.email?.split("@")[0]?.trim()) || "User";
  const email = user.email?.trim() ?? null;
  const phone =
    typeof user.phone === "string" && user.phone.trim()
      ? user.phone.trim()
      : typeof meta.phone_e164 === "string" && meta.phone_e164.trim()
        ? meta.phone_e164.trim()
        : null;

  const { data: existingProfile } = await supabaseAdmin
    .from("user_profiles")
    .select("user_id")
    .eq("user_id", uid)
    .maybeSingle();

  if (!existingProfile) {
    const { error: upErr } = await supabaseAdmin.from("user_profiles").insert({
      user_id: uid,
      full_name: fullName,
      email,
      phone,
      signup_origin_app: signupOriginApp,
    });
    if (upErr) {
      console.error("[ensureSharedUserTablesAfterOAuth] user_profiles:", upErr.message);
    }
  }

  if (signupOriginApp === "leadsmart") {
    const { data: existingLs } = await supabaseAdmin
      .from("leadsmart_users")
      .select("user_id")
      .eq("user_id", uid)
      .maybeSingle();

    if (!existingLs) {
      const { error: lsErr } = await supabaseAdmin.from("leadsmart_users").insert({
        user_id: uid,
        role: "user",
      });
      if (lsErr) {
        console.error("[ensureSharedUserTablesAfterOAuth] leadsmart_users:", lsErr.message);
      }
    }
  }

  if (signupOriginApp === "propertytools") {
    const { data: existingPt } = await supabaseAdmin
      .from("propertytools_users")
      .select("user_id")
      .eq("user_id", uid)
      .maybeSingle();

    if (!existingPt) {
      const { error: ptErr } = await supabaseAdmin.from("propertytools_users").insert({
        user_id: uid,
        tier: "basic",
      });
      if (ptErr) {
        console.error("[ensureSharedUserTablesAfterOAuth] propertytools_users:", ptErr.message);
      }
    }
  }
}
