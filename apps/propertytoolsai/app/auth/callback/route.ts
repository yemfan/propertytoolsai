import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { oauthBackfillFullName } from "@/lib/auth/canonicalUserContact";
import { supabaseAuthCookieOptions } from "@/lib/authCookieOptions";
import { requireSupabasePublicEnv } from "@/lib/supabasePublicEnv";

/**
 * OAuth PKCE callback: session cookies must be written onto the redirect {@link NextResponse},
 * not only via `cookies()` (Route Handlers need the Supabase SSR response-bound pattern).
 */
export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const nextRaw = requestUrl.searchParams.get("next") ?? "/dashboard";
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/dashboard";

  if (code) {
    const cookieStore = await cookies();
    const redirectUrl = new URL(next, requestUrl.origin);
    const response = NextResponse.redirect(redirectUrl);
    const { url, anonKey } = requireSupabasePublicEnv();
    const cookieOptions = supabaseAuthCookieOptions();

    const supabase = createServerClient(url, anonKey, {
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.user_metadata) {
        const meta = user.user_metadata as Record<string, unknown>;
        const backfill = oauthBackfillFullName(meta);
        if (backfill) {
          const { error: nameErr } = await supabase.auth.updateUser({ data: { full_name: backfill } });
          if (nameErr) {
            console.error("[auth/callback] oauth full_name backfill:", nameErr.message);
          }
        }
      }
      return response;
    }
  }

  return NextResponse.redirect(new URL("/login?error=oauth", requestUrl.origin));
}
