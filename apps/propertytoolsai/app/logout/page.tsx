"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

/**
 * Sign-out target page.
 *
 * Runs `supabase.auth.signOut()` on mount, then redirects to the home
 * page. The Account dropdown in the top-right has a "Log out" button
 * already (lib/layout/AccountMenu.tsx), but the dropdown trigger
 * isn't always visible — narrow viewports, auth-loading skeletons,
 * or just unfamiliar UX where users don't realize the avatar is a
 * menu trigger. This route gives the sidebar a permanent
 * `Account → Sign out` link so there's always an obvious way out.
 */
export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await supabaseBrowser().auth.signOut();
      } catch (e) {
        // Failure is non-fatal; redirect anyway. The session might
        // already be expired or the network might have blipped — in
        // either case landing on / unauthenticated is the right state.
        console.error("[logout] signOut failed:", e);
      }
      if (cancelled) return;
      // router.refresh() forces server components in the destination
      // to re-render against the now-empty session.
      router.refresh();
      router.push("/");
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8 text-sm text-slate-500">
      Signing out…
    </div>
  );
}
