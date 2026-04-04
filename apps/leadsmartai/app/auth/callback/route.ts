import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { oauthBackfillFullName } from "@/lib/auth/canonicalUserContact";
import { supabaseAuthCookieOptions } from "@/lib/authCookieOptions";
import { getPropertyToolsConsumerPostLoginUrl } from "@/lib/propertyToolsConsumerUrl";
import { fetchUserPortalContext } from "@/lib/rolePortalServer";
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

      const ctx = await fetchUserPortalContext(supabase);
      if (ctx && !ctx.isPro) {
        const { data: prof } = await supabase
          .from("leadsmart_users")
          .select("oauth_onboarding_completed")
          .eq("user_id", ctx.userId)
          .maybeSingle();
        const row = prof as { oauth_onboarding_completed?: boolean | null } | null;
        const onboardingDone = row?.oauth_onboarding_completed === true;
        if (!onboardingDone) {
          const completeUrl = new URL("/auth/complete-profile", url.origin);
          completeUrl.searchParams.set("next", next);
          const out = NextResponse.redirect(completeUrl);
          for (const v of response.headers.getSetCookie()) {
            out.headers.append("Set-Cookie", v);
          }
          return out;
        }
        const out = NextResponse.redirect(getPropertyToolsConsumerPostLoginUrl());
        for (const v of response.headers.getSetCookie()) {
          out.headers.append("Set-Cookie", v);
        }
        return out;
      }
      return response;
    }
  }

  return NextResponse.redirect(new URL("/?error=oauth", url.origin));
}
