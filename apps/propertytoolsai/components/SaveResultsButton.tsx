"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AuthModal from "@/components/AuthModal";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type SaveResultsButtonProps = {
  /** Tool key — same value you pass to ToolLeadGate (e.g. "mortgage_calculator"). */
  tool: string;
  /** Snapshot of the input form state at save time. */
  inputs: Record<string, unknown>;
  /** Snapshot of the computed result values at save time. */
  results: Record<string, unknown>;
  /** Optional address tagged onto the save for easy recognition. */
  propertyAddress?: string | null;
  /** Label for the button. Override per tool if you want. */
  label?: string;
  /** Additional classes merged into the button. */
  className?: string;
};

/**
 * "Save Results" CTA for calculator pages.
 *
 * UX:
 *   - If the visitor is signed in, saves immediately and shows a
 *     "Saved ✓ · View" inline confirmation linking to
 *     /account/saved-results.
 *   - If not signed in, opens the AuthModal in "signup" mode. After
 *     successful auth, the save retries automatically — no lost
 *     click.
 *
 * The save captures a full snapshot of (inputs, results, address) so
 * the user can later reopen the exact scenario.
 */
export function SaveResultsButton({
  tool,
  inputs,
  results,
  propertyAddress,
  label = "Save Results",
  className,
}: SaveResultsButtonProps) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingAfterAuth, setPendingAfterAuth] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<
    { tone: "ok"; id: string } | { tone: "err"; text: string } | null
  >(null);

  // Live auth-state subscription so the button flips behavior without
  // a reload after the user signs in via the modal.
  useEffect(() => {
    let cancelled = false;
    const supabase = supabaseBrowser();
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled) setSignedIn(!!data?.user);
    })();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setSignedIn(!!session?.user);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const doSave = useCallback(async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/saved-results", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tool,
          inputs,
          results,
          propertyAddress: propertyAddress || null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        row?: { id: string };
        error?: string;
      };
      if (res.status === 401) {
        // Lost session mid-click — reopen the modal and retry.
        setPendingAfterAuth(true);
        setAuthOpen(true);
        return;
      }
      if (!res.ok || !body.ok || !body.row) {
        setStatus({ tone: "err", text: body.error ?? "Failed to save." });
        return;
      }
      setStatus({ tone: "ok", id: body.row.id });
    } catch (e) {
      setStatus({
        tone: "err",
        text: e instanceof Error ? e.message : "Network error.",
      });
    } finally {
      setSaving(false);
    }
  }, [tool, inputs, results, propertyAddress]);

  const onClick = () => {
    if (signedIn) {
      void doSave();
    } else {
      setPendingAfterAuth(true);
      setAuthOpen(true);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={saving}
        className={
          className ??
          "inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
        }
      >
        {saving ? (
          <>Saving…</>
        ) : (
          <>
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            {label}
          </>
        )}
      </button>

      {status?.tone === "ok" ? (
        <span className="inline-flex items-center gap-2 text-sm text-green-700">
          Saved ✓
          <Link
            href="/account/saved-results"
            className="text-blue-600 hover:underline"
          >
            View saved
          </Link>
        </span>
      ) : null}
      {status?.tone === "err" ? (
        <span className="text-sm text-red-600">{status.text}</span>
      ) : null}
      {!signedIn && signedIn !== null ? (
        <span className="text-xs text-slate-500">Free — login required</span>
      ) : null}

      <AuthModal
        open={authOpen}
        onClose={() => {
          setAuthOpen(false);
          setPendingAfterAuth(false);
        }}
        onAuthenticated={() => {
          setAuthOpen(false);
          if (pendingAfterAuth) {
            setPendingAfterAuth(false);
            void doSave();
          }
        }}
        initialMode="signup"
      />
    </div>
  );
}
