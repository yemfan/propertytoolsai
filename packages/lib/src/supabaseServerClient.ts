import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function supabaseServerClient() {
  // In some Next.js versions/configs, `cookies()` can be a Promise.
  const cookieStorePromise = cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(supabaseUrl, anonKey, {
    cookies: {
      async getAll() {
        const cookieStore = await cookieStorePromise;
        const anyStore = cookieStore as any;

        if (typeof anyStore.getAll === "function") {
          return anyStore.getAll();
        }

        // Fallback for iterable cookie stores.
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
          // ignore
        }

        return [];
      },
      async setAll(cookiesToSet) {
        try {
          const cookieStore = await cookieStorePromise;
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set?.(name, value, options);
          });
        } catch {
          // ignore
        }
      },
    },
  });
}

