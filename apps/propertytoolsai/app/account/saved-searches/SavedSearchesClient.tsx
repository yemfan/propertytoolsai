"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, Pause, Play, Trash2 } from "lucide-react";
import type {
  AlertFrequency,
  SavedSearch,
  SavedSearchCriteria,
} from "@/lib/contacts/types";

type LoadState =
  | { kind: "loading" }
  | { kind: "unauthenticated" }
  | { kind: "ready"; searches: SavedSearch[] }
  | { kind: "error"; msg: string };

export default function SavedSearchesClient() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  async function load() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/consumer/saved-searches");
      if (res.status === 401) {
        setState({ kind: "unauthenticated" });
        return;
      }
      const data = (await res.json()) as { ok?: boolean; searches?: SavedSearch[]; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Load failed");
      setState({ kind: "ready", searches: data.searches ?? [] });
    } catch (e) {
      setState({ kind: "error", msg: e instanceof Error ? e.message : "Load failed" });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function updateFrequency(id: string, frequency: AlertFrequency) {
    await fetch(`/api/consumer/saved-searches/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertFrequency: frequency }),
    });
    await load();
  }

  async function archive(id: string) {
    await fetch(`/api/consumer/saved-searches/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await load();
  }

  if (state.kind === "loading") {
    return <div className="text-sm text-slate-500">Loading…</div>;
  }

  if (state.kind === "unauthenticated") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <h2 className="text-base font-semibold text-slate-900">Sign in to view saved searches</h2>
        <p className="mt-2 text-sm text-slate-600">
          Your saved searches are tied to your account so you get email alerts
          when matching listings come on market.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Link
            href="/login?next=/account/saved-searches"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Sign in
          </Link>
          <Link
            href="/signup?next=/account/saved-searches"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            Sign up
          </Link>
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {state.msg}
      </div>
    );
  }

  const { searches } = state;

  if (searches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
        <h2 className="text-base font-semibold text-slate-900">No saved searches yet</h2>
        <p className="mt-2 text-sm text-slate-600">
          Run a search on{" "}
          <Link href="/search" className="font-medium text-[#0066b3] hover:underline">
            Homes in Your Budget
          </Link>{" "}
          and click <span className="font-medium">Save this search</span> to start
          getting alerts.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {searches.map((s) => (
        <li
          key={s.id}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold text-slate-900">{s.name}</span>
                <FrequencyBadge frequency={s.alertFrequency} />
              </div>
              <div className="mt-1 text-xs text-slate-600">
                {summarize(s.criteria) || "Any listing"}
              </div>
              {s.lastAlertedAt && (
                <div className="mt-1 text-[11px] text-slate-400">
                  Last alert: {new Date(s.lastAlertedAt).toLocaleDateString()}
                </div>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {s.alertFrequency === "never" ? (
                <button
                  type="button"
                  onClick={() => updateFrequency(s.id, "daily")}
                  aria-label="Resume alerts"
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 hover:bg-slate-50"
                >
                  <Play className="h-3 w-3" /> Resume
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => updateFrequency(s.id, "never")}
                  aria-label="Pause alerts"
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 hover:bg-slate-50"
                >
                  <Pause className="h-3 w-3" /> Pause
                </button>
              )}
              <button
                type="button"
                onClick={() => archive(s.id)}
                aria-label="Delete"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function FrequencyBadge({ frequency }: { frequency: AlertFrequency }) {
  const label =
    frequency === "never"
      ? "Paused"
      : frequency === "instant"
        ? "Instant"
        : frequency === "daily"
          ? "Daily"
          : "Weekly";
  const Icon = frequency === "never" ? BellOff : Bell;
  const classes =
    frequency === "never"
      ? "bg-slate-100 text-slate-500"
      : "bg-emerald-50 text-emerald-700";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${classes}`}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden /> {label}
    </span>
  );
}

function summarize(c: SavedSearchCriteria): string {
  const parts: string[] = [];
  if (c.propertyType && c.propertyType !== "any") parts.push(c.propertyType.replace(/_/g, " "));
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
