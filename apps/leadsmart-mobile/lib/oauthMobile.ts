import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAuthClient } from "./supabaseAuthClient";

/** Narrow typings in some setups omit OAuth helpers; runtime matches @supabase/supabase-js v2. */
function authApi(supabase: SupabaseClient): SupabaseClient["auth"] & Record<string, unknown> {
  return supabase.auth as SupabaseClient["auth"] & Record<string, unknown>;
}

WebBrowser.maybeCompleteAuthSession();

/**
 * Must match Supabase Dashboard → Authentication → URL Configuration → Redirect URLs:
 *   leadsmart://auth/callback
 */
export function getOAuthRedirectUri(): string {
  return makeRedirectUri({ scheme: "leadsmart", path: "auth/callback" });
}

async function applyOAuthRedirectToSession(supabase: SupabaseClient, url: string): Promise<void> {
  const hashIdx = url.indexOf("#");
  const hash = hashIdx >= 0 ? url.slice(hashIdx + 1) : "";
  const hashParams = new URLSearchParams(hash);
  const access_token = hashParams.get("access_token");
  const refresh_token = hashParams.get("refresh_token");
  const auth = authApi(supabase);

  if (access_token && refresh_token) {
    const { error } = await (auth.setSession as (a: { access_token: string; refresh_token: string }) => Promise<{ error: { message: string } | null }>)({
      access_token,
      refresh_token,
    });
    if (error) throw error;
    return;
  }

  let code: string | null = null;
  try {
    code = new URL(url).searchParams.get("code");
  } catch {
    const parsed = Linking.parse(url);
    const q = parsed.queryParams?.code;
    code = typeof q === "string" ? q : null;
  }
  if (code) {
    const { error } = await (auth.exchangeCodeForSession as (c: string) => Promise<{ error: { message: string } | null }>)(code);
    if (error) throw error;
    return;
  }

  throw new Error("Could not complete sign-in from the redirect URL.");
}

/** Google (and Apple on Android): in-app browser OAuth → deep link back to the app. */
export async function signInWithOAuthBrowser(
  provider: "google" | "apple",
  supabase: SupabaseClient
): Promise<void> {
  const redirectTo = getOAuthRedirectUri();
  const auth = authApi(supabase);
  const { data, error } = await (auth.signInWithOAuth as (a: {
    provider: "google" | "apple";
    options: { redirectTo: string; skipBrowserRedirect: boolean };
  }) => Promise<{ data: { url: string | null }; error: { message: string } | null }>)({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error("No OAuth URL returned.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success" || !("url" in result) || !result.url) {
    throw new Error(result.type === "cancel" ? "Sign in cancelled." : "Sign in was not completed.");
  }

  await applyOAuthRedirectToSession(supabase, result.url);
}

/**
 * Apple: native Sign in with Apple on iOS when available; otherwise same as OAuth browser flow.
 */
export async function signInWithApple(supabase: SupabaseClient): Promise<void> {
  if (Platform.OS !== "ios") {
    await signInWithOAuthBrowser("apple", supabase);
    return;
  }

  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    await signInWithOAuthBrowser("apple", supabase);
    return;
  }

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  const idToken = credential.identityToken;
  if (!idToken) {
    throw new Error("Apple did not return an identity token.");
  }

  const auth = authApi(supabase);
  const { error } = await (auth.signInWithIdToken as (a: { provider: "apple"; token: string }) => Promise<{ error: { message: string } | null }>)({
    provider: "apple",
    token: idToken,
  });
  if (error) throw error;
}

export async function signInWithGoogle(supabase: SupabaseClient): Promise<void> {
  await signInWithOAuthBrowser("google", supabase);
}

/** @returns null if Supabase env is missing */
export function getSupabaseAuthClientOrThrow(): SupabaseClient {
  const supabase = getSupabaseAuthClient();
  if (!supabase) {
    throw new Error("Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return supabase;
}
