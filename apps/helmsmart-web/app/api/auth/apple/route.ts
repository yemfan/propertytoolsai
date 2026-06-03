/**
 * GET /api/auth/apple — initiates Apple Sign In via Supabase.
 * Requires Apple provider enabled in Supabase dashboard +
 * Apple Developer account with Sign in with Apple capability.
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const cookieStore = await cookies();

  const supabase = createServerClient(
    "https://vpmwsnoosuiknyzdxgtk.supabase.co",
    process.env.NEXT_PUBLIC_SMBAI_SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwbXdzbm9vc3Vpa255emR4Z3RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NDU5MTgsImV4cCI6MjA5NTQyMTkxOH0.eAn1vPTAHXj_4OMd9T50LcazrxnvMxkcfFs-de98SNg",
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

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: { redirectTo: `${origin}/api/auth/callback` },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  return NextResponse.redirect(data.url);
}
