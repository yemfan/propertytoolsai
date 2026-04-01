"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { messageFromUnknownError } from "@/lib/supabaseThrow";

type Props = {
  backHref: string;
};

export function StartFreeAgentActions({ backHref }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startFree() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/agent/start-free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan: "starter" }),
      });
      const json = (await res.json()) as { ok?: boolean; success?: boolean; error?: unknown };
      const ok = json.ok ?? json.success;
      if (!res.ok || !ok) {
        setError(messageFromUnknownError(json.error, "Could not activate Starter. Try again."));
        return;
      }
      router.push("/agent/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => void startFree()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Activate Starter (free)
          {!loading ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
        </button>
        <Link
          href="/agent/pricing"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
        >
          Compare Plans
        </Link>
        <Link
          href={backHref}
          className="inline-flex items-center justify-center rounded-xl border border-transparent px-5 py-3 text-sm font-semibold text-blue-700 hover:text-blue-800"
        >
          Back to My Dashboard
        </Link>
      </div>
    </div>
  );
}
