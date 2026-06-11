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
    // `scope: "local"` clears this browser's session cookies without the
    // server round-trip that `global` (the default) makes — that call can
    // reject or, worse, never settle (supabase-js serializes auth ops
    // behind a navigator lock another tab may hold), which left the
    // button doing nothing. The timeout race guarantees we always reach
    // the hard navigation below.
    await Promise.race([
      supabaseBrowser().auth.signOut({ scope: "local" }),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch (e) {
    console.error("signOut failed", e);
  }
  if (typeof window !== "undefined") {
    window.location.assign(nextPath);
  }
}
