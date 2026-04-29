"use client";

import { useEffect, useState } from "react";

/**
 * Settings panel for LeadSmart AI Coaching enrollments.
 *
 * Lets the agent see every program their plan can access and
 * toggle enrollment per program. Re-enrollment is a one-click
 * action; opt-out asks for a brief reason (optional, capped at
 * 280 chars).
 *
 * Source of truth is `/api/coaching/me` for the read side and
 * `/api/coaching/programs/:slug/{enroll,opt-out}` for writes.
 * After every successful write we re-fetch `/me` so the UI stays
 * consistent with whatever auto-enrollment hooks ran server-side.
 */

type ProgramStatus =
  | "enrolled"
  | "opted_out"
  | "eligible_not_enrolled"
  | "not_eligible";

type ProgramView = {
  slug: "producer_track" | "top_producer_track";
  status: ProgramStatus;
  enrolledAt: string | null;
  meta: {
    name: string;
    tagline: string;
    annualTransactionTarget: number;
    conversionRateTargetPct: number;
  };
};

type ApiResponse = {
  ok: boolean;
  plan: string | null;
  programs: ProgramView[];
};

export function CoachingSettingsPanel() {
  const [programs, setPrograms] = useState<ProgramView[] | null>(null);
  const [planLabel, setPlanLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const r = await fetch("/api/coaching/me", { cache: "no-store" });
      const j = (await r.json()) as ApiResponse;
      setPrograms(j.programs ?? []);
      setPlanLabel(j.plan ?? null);
    } catch {
      setPrograms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const onEnroll = async (slug: ProgramView["slug"]) => {
    setBusySlug(slug);
    setError(null);
    try {
      const r = await fetch(`/api/coaching/programs/${slug}/enroll`, {
        method: "POST",
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(j?.message ?? "Could not enroll right now.");
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusySlug(null);
    }
  };

  const onOptOut = async (slug: ProgramView["slug"]) => {
    const reason =
      typeof window !== "undefined"
        ? window.prompt(
            "Optional — anything we should know about why you're opting out?",
            "",
          )
        : null;
    setBusySlug(slug);
    setError(null);
    try {
      const r = await fetch(`/api/coaching/programs/${slug}/opt-out`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason ?? "" }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(j?.message ?? "Could not opt out right now.");
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusySlug(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
      </div>
    );
  }

  const visible =
    programs?.filter((p) => p.status !== "not_eligible") ?? [];

  if (visible.length === 0) {
    return (
      <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4 text-sm text-slate-700">
        Coaching unlocks on Pro and above.{" "}
        <a
          href="/agent/pricing"
          className="font-semibold text-blue-700 hover:underline"
        >
          See pricing →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
        >
          {error}
        </div>
      ) : null}

      {visible.map((p) => (
        <ProgramRow
          key={p.slug}
          program={p}
          busy={busySlug === p.slug}
          onEnroll={() => onEnroll(p.slug)}
          onOptOut={() => onOptOut(p.slug)}
        />
      ))}

      <p className="pt-1 text-[11px] text-slate-500">
        Plan: <span className="font-semibold text-slate-700">{planLabel ?? "—"}</span>
        {" · "}
        Auto-enrollment runs on plan upgrades and on dashboard mount, but always
        respects prior opt-outs.
      </p>
    </div>
  );
}

function ProgramRow({
  program,
  busy,
  onEnroll,
  onOptOut,
}: {
  program: ProgramView;
  busy: boolean;
  onEnroll: () => void;
  onOptOut: () => void;
}) {
  const isEnrolled = program.status === "enrolled";
  const isOptedOut = program.status === "opted_out";
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">
          {program.meta.name}
        </p>
        <p className="mt-0.5 text-xs text-slate-600">{program.meta.tagline}</p>
        <p className="mt-1 text-[11px] uppercase tracking-wider font-semibold">
          {isEnrolled ? (
            <span className="text-blue-700">Enrolled</span>
          ) : isOptedOut ? (
            <span className="text-slate-500">Opted out</span>
          ) : (
            <span className="text-amber-700">Eligible — not enrolled</span>
          )}
        </p>
      </div>
      <div className="shrink-0">
        {isEnrolled ? (
          <button
            type="button"
            onClick={onOptOut}
            disabled={busy}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-50"
          >
            {busy ? "Opting out…" : "Opt out"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onEnroll}
            disabled={busy}
            className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Enrolling…" : isOptedOut ? "Re-enroll" : "Enroll"}
          </button>
        )}
      </div>
    </div>
  );
}
