"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { acceptInvitation } from "@/lib/actions/team";

export function AcceptButton({ token, orgName }: { token: string; orgName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone]   = useState(false);

  function handleAccept() {
    setError("");
    start(async () => {
      try {
        const { orgId } = await acceptInvitation(token);
        setDone(true);
        // Set org cookie then redirect to home
        document.cookie = `smbai-org-id=${orgId}; path=/; max-age=${60 * 60 * 24 * 365}`;
        setTimeout(() => router.push("/home"), 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to accept invitation");
      }
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-2">
        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        <p className="text-sm font-medium text-slate-700">Joined! Redirecting to your workspace…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleAccept}
        disabled={pending}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors"
      >
        {pending ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</>
        ) : (
          `Accept & join ${orgName}`
        )}
      </button>
      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-4 py-2 text-center">{error}</p>
      )}
    </div>
  );
}
