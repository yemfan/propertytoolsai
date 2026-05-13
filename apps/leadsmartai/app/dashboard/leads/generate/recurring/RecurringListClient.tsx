"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Client-side list + lifecycle controls for recurring post
 * schedules. Three sections by status:
 *   - Active (next firing time, pause/cancel actions)
 *   - Paused (resume/cancel actions)
 *   - Completed / Cancelled (read-only, last 90 days)
 *
 * No edit-in-place — to change the template / cadence the agent
 * cancels + creates a new recurrence. Keeps the lifecycle simple
 * (state transitions are bounded + auditable) and the wizard is
 * already the natural place to author one.
 */

type Recurrence = {
  id: string;
  platform: "facebook" | "instagram" | "linkedin";
  caption: string;
  cadence: "daily" | "weekly";
  weeklyDayOfWeek: number | null;
  timeOfDayHour: number;
  timeOfDayMinute: number;
  timezone: string;
  startsAt: string;
  endsAt: string | null;
  maxOccurrences: number | null;
  occurrenceCount: number;
  nextOccurrenceAt: string;
  lastMaterializedAt: string | null;
  status: "active" | "paused" | "completed" | "cancelled";
  lastError: string | null;
  socialAccountDisplay: string | null;
  createdAt: string;
};

const PLATFORM_LABEL: Record<Recurrence["platform"], string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
};

const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function describeCadence(r: Recurrence): string {
  const hh = String(r.timeOfDayHour).padStart(2, "0");
  const mm = String(r.timeOfDayMinute).padStart(2, "0");
  const tz = r.timezone;
  if (r.cadence === "daily") {
    return `Every day at ${hh}:${mm} ${tz}`;
  }
  const day =
    r.weeklyDayOfWeek !== null
      ? WEEKDAY_LABEL[r.weeklyDayOfWeek]
      : "?";
  return `Every ${day} at ${hh}:${mm} ${tz}`;
}

export default function RecurringListClient() {
  const [recurrences, setRecurrences] = useState<Recurrence[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/leads-gen/recurring/list");
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        recurrences?: Recurrence[];
        error?: string;
      };
      if (!res.ok || !body.ok)
        throw new Error(body.error ?? "Failed to load");
      setRecurrences(body.recurrences ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRecurrences([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (id: string, action: "pause" | "resume" | "cancel") => {
      if (action === "cancel" && !confirm("Cancel this recurrence? This is permanent.")) {
        return;
      }
      setActionError(null);
      setActionId(id);
      try {
        const res = await fetch(`/api/leads-gen/recurring/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!res.ok || !body.ok) throw new Error(body.error ?? `${action} failed`);
        await load();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : `${action} failed`);
      } finally {
        setActionId(null);
      }
    },
    [load],
  );

  if (recurrences === null) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  if (recurrences.length === 0) {
    return (
      <div className="space-y-3">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/60 p-10 text-center">
          <p className="text-sm text-gray-600">No recurring posts yet.</p>
          <p className="mt-1 text-xs text-gray-500">
            Create one from the Quick Post wizard — toggle{" "}
            <span className="font-medium">Make this recurring</span> when
            you have a draft ready.
          </p>
          <a
            href="/dashboard/leads/generate/post/new"
            className="mt-4 inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Open Quick Post
          </a>
        </div>
      </div>
    );
  }

  const active = recurrences.filter((r) => r.status === "active");
  const paused = recurrences.filter((r) => r.status === "paused");
  const completedOrCancelled = recurrences.filter(
    (r) => r.status === "completed" || r.status === "cancelled",
  );

  return (
    <div className="space-y-6">
      {(error || actionError) && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error || actionError}
        </div>
      )}

      {active.length > 0 && (
        <Section title="Active" subtitle="The cron is materializing posts for these.">
          {active.map((r) => (
            <Card
              key={r.id}
              recurrence={r}
              busy={actionId === r.id}
              actions={[
                { label: "Pause", onClick: () => act(r.id, "pause") },
                { label: "Cancel", onClick: () => act(r.id, "cancel"), variant: "danger" },
              ]}
            />
          ))}
        </Section>
      )}

      {paused.length > 0 && (
        <Section
          title="Paused"
          subtitle="Materialize cron is skipping these. Resume to re-enable."
        >
          {paused.map((r) => (
            <Card
              key={r.id}
              recurrence={r}
              busy={actionId === r.id}
              actions={[
                { label: "Resume", onClick: () => act(r.id, "resume") },
                { label: "Cancel", onClick: () => act(r.id, "cancel"), variant: "danger" },
              ]}
            />
          ))}
        </Section>
      )}

      {completedOrCancelled.length > 0 && (
        <Section title="Recent (completed / cancelled)" subtitle="Read-only.">
          {completedOrCancelled.slice(0, 20).map((r) => (
            <Card key={r.id} recurrence={r} busy={false} actions={[]} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Card({
  recurrence,
  busy,
  actions,
}: {
  recurrence: Recurrence;
  busy: boolean;
  actions: Array<{ label: string; onClick: () => void; variant?: "danger" }>;
}) {
  const r = recurrence;
  const next = new Date(r.nextOccurrenceAt);
  const ends = r.endsAt ? new Date(r.endsAt) : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-xs">
            <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
              {PLATFORM_LABEL[r.platform]}
            </span>
            {r.socialAccountDisplay && (
              <span className="truncate text-gray-500">
                {r.socialAccountDisplay}
              </span>
            )}
            <StatusBadge status={r.status} />
          </div>
          <p className="text-sm font-semibold text-gray-900">
            {describeCadence(r)}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">
            {r.caption}
          </p>
          <p className="mt-2 text-[11px] text-gray-500">
            {r.status === "active" && (
              <>Next: {next.toLocaleString()} · </>
            )}
            {r.status === "paused" && (
              <>
                Paused — next would have been {next.toLocaleString()} ·{" "}
              </>
            )}
            Posted {r.occurrenceCount}
            {r.maxOccurrences ? ` of ${r.maxOccurrences}` : ""} time
            {r.occurrenceCount === 1 ? "" : "s"}
            {ends && <> · Ends {ends.toLocaleDateString()}</>}
          </p>
          {r.lastError && (
            <p className="mt-1 line-clamp-2 text-[11px] text-red-700">
              Last error: {r.lastError}
            </p>
          )}
        </div>
        {actions.length > 0 && (
          <div className="flex shrink-0 gap-2">
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={a.onClick}
                disabled={busy}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                  a.variant === "danger"
                    ? "border-red-300 bg-white text-red-700 hover:bg-red-50"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {busy ? "…" : a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Recurrence["status"] }) {
  const cls =
    status === "active"
      ? "bg-emerald-100 text-emerald-800"
      : status === "paused"
        ? "bg-amber-100 text-amber-900"
        : status === "completed"
          ? "bg-gray-100 text-gray-700"
          : "bg-red-100 text-red-800";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {status}
    </span>
  );
}
