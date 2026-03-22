import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAuthCookieOptions } from "@/lib/authCookieOptions";

export function supabaseServerClient() {
  // In some Next.js versions/configs, `cookies()` can be a Promise.
  // We must not access properties on it synchronously.
  const cookieStorePromise = cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cookieOptions = supabaseAuthCookieOptions();

  return createServerClient(supabaseUrl, anonKey, {
    ...(cookieOptions ? { cookieOptions } : {}),
    cookies: {
      async getAll() {
        const cookieStore = await cookieStorePromise;
        const anyStore = cookieStore as any;

        // Next.js cookie APIs differ slightly across versions.
        // Prefer getAll() when available.
        if (typeof anyStore.getAll === "function") {
          return anyStore.getAll();
        }

        // Fallback: cookie store is iterable in some Next versions.
        try {
          const iterable = anyStore?.[Symbol.iterator];
          if (typeof iterable === "function") {
            const result: Array<{ name: string; value: string }> = [];
            for (const c of anyStore as any) {
              if (!c) continue;
              if (typeof c.name === "string" && typeof c.value !== "undefined") {
                result.push({ name: c.name, value: c.value });
              }
            }
            return result;
          }
        } catch {
          // Ignore and fall through
        }

        return [];
      },
      async setAll(cookiesToSet) {
        try {
          const cookieStore = await cookieStorePromise;
          cookiesToSet.forEach(({ name, value, options }) => {
            // `cookies()` in route handlers supports set(). In some contexts it might not.
            cookieStore.set?.(name, value, options);
          });
        } catch {
          // Server Components may throw when setting cookies; ignore.
        }
      },
    },
  });
}

