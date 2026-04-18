"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import type {
  AlertFrequency,
  PropertyTypeFilter,
  SavedSearchCriteria,
} from "@/lib/contacts/types";

type Props = {
  /** Current search criteria from URL query params. */
  criteria: SavedSearchCriteria;
  /** Optional — what to display if the user hasn't supplied a name yet. */
  suggestedName?: string;
};

/**
 * "Save this search" button for the /search page. POSTs to
 * /api/consumer/saved-searches. Requires the consumer to be logged in;
 * anonymous clicks get redirected to the login flow with a `?next=`
 * param so they return to the same search after sign-in.
 */
export function SaveThisSearchButton({ criteria, suggestedName }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggestedName ?? summarize(criteria));
  const [frequency, setFrequency] = useState<AlertFrequency>("daily");
  const [state, setState] = useState<
    { status: "idle" } | { status: "saving" } | { status: "saved" } | { status: "needs_login" } | { status: "error"; msg: string }
  >({ status: "idle" });

  async function submit() {
    setState({ status: "saving" });
    try {
      const res = await fetch("/api/consumer/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "My search",
          criteria,
          alertFrequency: frequency,
        }),
      });
      if (res.status === 401) {
        setState({ status: "needs_login" });
        return;
      }
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Save failed");
      setState({ status: "saved" });
      setTimeout(() => setOpen(false), 1200);
    } catch (e) {
      setState({ status: "error", msg: e instanceof Error ? e.message : "Save failed" });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setState({ status: "idle" });
        }}
        className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300 hover:bg-gray-50"
      >
        <Bookmark className="h-4 w-4" aria-hidden />
        Save this search
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            {state.status === "saved" ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <BookmarkCheck className="h-8 w-8 text-emerald-600" aria-hidden />
                <div className="text-base font-semibold text-gray-900">Search saved</div>
                <div className="text-sm text-gray-600">
                  We&apos;ll email you when new listings match your criteria.
                </div>
              </div>
            ) : state.status === "needs_login" ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">Sign in to save</h2>
                <p className="text-sm text-gray-600">
                  Create a free account to save searches and get email alerts
                  when new listings match your criteria.
                </p>
                <div className="flex gap-2">
                  <a
                    href={`/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "/search")}`}
                    className="flex-1 rounded-xl bg-gray-900 px-4 py-2 text-center text-sm font-medium text-white"
                  >
                    Sign in
                  </a>
                  <a
                    href={`/signup?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "/search")}`}
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700"
                  >
                    Sign up
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-500"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
                className="space-y-4"
              >
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Save this search</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Get notified when new listings match.
                  </p>
                </div>

                <label className="block">
                  <span className="text-xs font-medium text-gray-700">Name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="My search"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-gray-700">Alert frequency</span>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as AlertFrequency)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="instant">Instant — as soon as a listing matches</option>
                    <option value="daily">Daily digest</option>
                    <option value="weekly">Weekly digest</option>
                    <option value="never">Save for reference (no emails)</option>
                  </select>
                </label>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                  <div className="font-medium text-gray-700">Your criteria:</div>
                  <div className="mt-0.5">{summarize(criteria) || "Any listing"}</div>
                </div>

                {state.status === "error" && (
                  <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                    {state.msg}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={state.status === "saving"}
                    className="flex-1 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {state.status === "saving" ? "Saving…" : "Save search"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function summarize(c: SavedSearchCriteria): string {
  const parts: string[] = [];
  const pt = c.propertyType as PropertyTypeFilter | undefined;
  if (pt && pt !== "any") parts.push(pt.replace(/_/g, " "));
  if (c.bedsMin) parts.push(`${c.bedsMin}+ bd`);
  if (c.bathsMin) parts.push(`${c.bathsMin}+ ba`);
  if (c.priceMin || c.priceMax) {
    const min = c.priceMin ? `$${(c.priceMin / 1000).toFixed(0)}k` : "any";
    const max = c.priceMax ? `$${(c.priceMax / 1000).toFixed(0)}k` : "any";
    parts.push(`${min}–${max}`);
  }
  const loc = [c.city, c.state, c.zip].filter(Boolean).join(" ").trim();
  if (loc) parts.push(loc);
  return parts.join(" · ");
}
