import { supabaseBrowser } from "@/lib/supabaseBrowser";

/**
 * End the Supabase session and navigate with a full page load.
 *
 * With `@supabase/ssr` cookie sessions, `router.push` + `router.refresh` alone can leave
 * the UI or middleware thinking the user is still signed in. A hard navigation matches
 * the pattern used elsewhere (e.g. PropertyTools `LogoutButton`) and reloads cookies + RSC.
 */
export async function signOutWithFullReload(nextPath = "/") {
  try {
    await supabaseBrowser().auth.signOut();
  } catch (e) {
    console.error("signOut failed", e);
  }
  if (typeof window !== "undefined") {
    window.location.assign(nextPath);
  }
}
