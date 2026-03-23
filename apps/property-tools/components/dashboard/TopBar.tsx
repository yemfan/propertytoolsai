"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function TopBar({
  email,
}: {
  email: string | null | undefined;
}) {
  const router = useRouter();
  const [tokens, setTokens] = useState<number | null>(null);
  const [plan, setPlan] = useState<string | null>(null);

  async function onLogout() {
    try {
      await supabaseBrowser().auth.signOut();
    } catch (e) {
      console.error("Logout failed", e);
    } finally {
      router.push("/login?redirect=/");
      router.refresh?.();
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = supabaseBrowser();
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        const res = await fetch("/api/me", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const json = (await res.json().catch(() => ({}))) as any;
        if (cancelled) return;
        setTokens(typeof json?.tokens_remaining === "number" ? json.tokens_remaining : null);
        setPlan(typeof json?.plan === "string" ? json.plan : null);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-brand-text truncate">
            Agent dashboard
          </div>
          <div className="text-xs text-gray-500 truncate">
            {email ? `Signed in as ${email}` : "Signed in"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {typeof tokens === "number" ? (
            <div className="text-xs font-semibold px-3 py-2 rounded-lg bg-brand-surface border border-gray-200 text-brand-text">
              {tokens} tokens left{plan ? ` (${plan})` : ""}
            </div>
          ) : null}

          <Link
            href="/pricing"
            className="text-sm font-semibold px-3 py-2 rounded-lg bg-brand-primary text-white hover:bg-[#005ca8]"
          >
            Upgrade
          </Link>

          <button
            type="button"
            onClick={onLogout}
            className="text-sm font-semibold px-3 py-2 rounded-lg bg-white border border-gray-300 text-brand-text hover:bg-brand-surface"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

