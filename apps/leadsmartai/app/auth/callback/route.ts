import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAuthCookieOptions } from "@/lib/authCookieOptions";
import { requireSupabasePublicEnv } from "@/lib/supabasePublicEnv";

/**
 * OAuth redirect target (Google / Apple via Supabase).
 * Add this URL to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs:
 *   https://<your-domain>/auth/callback
 *
 * Cookies must be set on the {@link NextResponse} so the session survives the redirect
 * (see Supabase SSR + Next.js App Router route handler pattern).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextRaw = url.searchParams.get("next") ?? "/";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  if (code) {
    const cookieStore = await cookies();
    const redirectUrl = new URL(next, url.origin);
    const response = NextResponse.redirect(redirectUrl);
    const { url: supabaseUrl, anonKey } = requireSupabasePublicEnv();
    const cookieOptions = supabaseAuthCookieOptions();

    const supabase = createServerClient(supabaseUrl, anonKey, {
      ...(cookieOptions ? { cookieOptions } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
  }

  return NextResponse.redirect(new URL("/?error=oauth", url.origin));
}
