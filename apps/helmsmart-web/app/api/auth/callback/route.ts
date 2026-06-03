import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Supabase email-confirmation callback.
 *
 * Supabase redirects here after a user clicks the confirmation link:
 *   /api/auth/callback?code=<pkce-code>
 *
 * We exchange the code for a session, then redirect:
 *   - /onboarding  if the user has no org yet
 *   - /books       if they already completed onboarding
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    // Malformed callback — send to login with a generic error param
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    (process.env.NEXT_PUBLIC_HELM_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SMBAI_SUPABASE_URL)!,
    (process.env.NEXT_PUBLIC_HELM_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SMBAI_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("auth callback error:", error.message);
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }

  // `next` param lets callers override the post-auth destination (e.g. /reset-password)
  const next = searchParams.get("next");
  if (next?.startsWith("/")) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // Check whether user already has an org (cookie set by createOrg server action)
  const orgId = cookieStore.get("helmsmart-org-id")?.value;

  return NextResponse.redirect(`${origin}${orgId ? "/home" : "/onboarding"}`);
}
