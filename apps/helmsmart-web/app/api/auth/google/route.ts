/**
 * GET /api/auth/google — initiates Google OAuth via Supabase.
 * Redirects the browser to Google's consent screen.
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { browserConnForHost } from "@/lib/pack-host";

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  // Pack-aware: medical.* / doctor.* OAuth runs against the medical project.
  const conn = browserConnForHost(request.headers.get("host") ?? new URL(request.url).host);
  const cookieStore = await cookies();

  const supabase = createServerClient(
    conn.url,
    conn.key,
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
    provider: "google",
    options: {
      redirectTo: `${origin}/api/auth/callback`,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  return NextResponse.redirect(data.url);
}
