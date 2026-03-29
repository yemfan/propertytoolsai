import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Merges with `app.json`. Use `EXPO_PUBLIC_LEADSMART_API_URL` for the LeadSmart web API
 * (e.g. `https://your-leadsmart.vercel.app` — no trailing slash).
 */
function envFirst(...keys: (string | undefined)[]): string {
  for (const k of keys) {
    const v = k?.trim();
    if (v) return v;
  }
  return "";
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "LeadSmart",
  slug: config.slug ?? "leadsmart-mobile",
  extra: {
    ...config.extra,
    /** Supports `EXPO_PUBLIC_*` (Expo) or `NEXT_PUBLIC_*` (shared .env.local with web). */
    leadsmartApiUrl: envFirst(
      process.env.EXPO_PUBLIC_LEADSMART_API_URL,
      process.env.NEXT_PUBLIC_LEADSMART_API_URL
    ),
    /** Dev: Supabase JWT for `Authorization: Bearer` (same session as LeadSmart web). */
    leadsmartAccessToken: envFirst(
      process.env.EXPO_PUBLIC_LEADSMART_ACCESS_TOKEN,
      process.env.NEXT_PUBLIC_LEADSMART_ACCESS_TOKEN
    ),
    supabaseUrl: envFirst(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: envFirst(
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
    /** EAS project ID for `getExpoPushTokenAsync` (production / dev builds). */
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ?? "",
    },
  },
});
