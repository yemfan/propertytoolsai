import Constants from "expo-constants";
import { getCachedAccessToken } from "./session/tokenCache";

/** Base URL for `apps/leadsmartai` (Next) API routes, without trailing slash. */
export function getLeadsmartApiBaseUrl(): string {
  const fromExtra = Constants.expoConfig?.extra?.leadsmartApiUrl;
  if (typeof fromExtra === "string" && fromExtra.trim()) {
    return fromExtra.replace(/\/$/, "");
  }
  return "";
}

/** JWT for mobile API routes (`getUserFromRequest` bearer path). */
export function getLeadsmartAccessToken(): string {
  const fromSession = getCachedAccessToken();
  if (fromSession) return fromSession;

  const fromEnv = process.env.EXPO_PUBLIC_LEADSMART_ACCESS_TOKEN;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.trim();
  }
  const fromExtra = Constants.expoConfig?.extra?.leadsmartAccessToken;
  if (typeof fromExtra === "string" && fromExtra.trim()) {
    return fromExtra.trim();
  }
  return "";
}

/** Supabase project URL — `EXPO_PUBLIC_` or `NEXT_PUBLIC_` (shared `.env.local` with web). */
export function getSupabaseUrl(): string {
  const fromEnv =
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/$/, "");
  }
  const fromExtra = Constants.expoConfig?.extra?.supabaseUrl;
  if (typeof fromExtra === "string" && fromExtra.trim()) {
    return fromExtra.trim().replace(/\/$/, "");
  }
  return "";
}

/** Supabase anon key for Realtime + RLS. */
export function getSupabaseAnonKey(): string {
  const fromEnv =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.trim();
  }
  const fromExtra = Constants.expoConfig?.extra?.supabaseAnonKey;
  if (typeof fromExtra === "string" && fromExtra.trim()) {
    return fromExtra.trim();
  }
  return "";
}
