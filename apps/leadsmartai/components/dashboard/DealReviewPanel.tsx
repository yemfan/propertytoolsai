"use client";

import { useCallback, useEffect, useState } from "react";
import type { DealReview } from "@/lib/deal-review/types";

/**
 * AI Deal Review panel. Renders on closed transactions (parent enforces).
 * First open: loads cached review or generates via Claude (~15s).
 * Agent can force-regenerate with the button.
 */

type ReviewResponse = {
  ok: boolean;
  review: DealReview;
  fromCache: boolean;
  usedFallback: boolean;
  aiConfigured: boolean;
  error?: string;
};

export function DealReviewPanel({ transactionId }: { transactionId: string }) {
  const [resp, setResp] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force = false) => {
      setError(null);
      if (force) setRegenerating(true);
      else setLoading(true);
      try {
        const res = await fetch(
          `/api/dashboard/transactions/${transactionId}/review`,
          { method: force ? "POST" : "GET" },
        );
        const body = (await res.json().catch(() => null)) as ReviewResponse | null;
        if (!res.ok || !body || !body.ok) {
          setError(body?.error ?? "Couldn't load deal review.");
          return;
        }
        setResp(body);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error.");
      } finally {
        setLoading(false);
        setRegenerating(false);
      }
    },
    [transactionId],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            🧠 AI deal review
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Post-mortem on this closed deal — timeline, stall points, and what to repeat
            or change next time.
          </p>
        </div>
        {resp ? (
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={regenerating || loading}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {regenerating ? "Generating…" : "↻ Regenerate"}
          </button>
        ) : null}
      </div>

      {loading && !resp ? (
        <div className="mt-6 rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">
          Generating your deal review. This takes about 15 seconds the first time.
        </div>
      ) : error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : resp ? (
        <ReviewBody resp={resp} dimmed={regenerating} />
      ) : null}
    </section>
  );
}

function ReviewBody({ resp, dimmed }: { resp: ReviewResponse; dimmed: boolean }) {
  const { review } = resp;
  return (
    <div className={`mt-4 space-y-4 ${dimmed ? "opacity-60" : ""}`}>
      {/* Headline + summary */}
      <div className="rounded-lg bg-slate-50 p-4">
        <div className="text-base font-semibold text-slate-900">
          {review.headline}
        </div>
        {review.summary ? (
          <p className="mt-1 text-sm text-slate-700 leading-6">{review.summary}</p>
        ) : null}
        {review.executionScore != null ? (
          <div className="mt-2 inline-flex items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold">Execution score:</span>
            <span className="tabular-nums">
              {Math.round(review.executionScore * 100)}
              <span className="text-slate-400"> / 100</span>
            </span>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {review.whatWentWell.length > 0 ? (
          <Section title="What went well" tone="green" items={review.whatWentWell} />
        ) : null}
        {review.whereItStalled.length > 0 ? (
          <Section title="Where it stalled" tone="amber" items={review.whereItStalled} />
        ) : null}
        {review.patternObservations.length > 0 ? (
          <Section
            title="Vs your other deals"
            tone="blue"
            items={review.patternObservations}
            wide
          />
        ) : null}
        {review.doDifferentlyNextTime.length > 0 ? (
          <Section
            title="Do differently next time"
            tone="slate"
            items={review.doDifferentlyNextTime}
            wide
          />
        ) : null}
      </div>

      {/* Footer: provenance + fallback notice */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
        <span>
          Generated {new Date(review.generatedAtIso).toLocaleString()}
          {resp.fromCache ? " (cached)" : ""}
        </span>
        {resp.usedFallback ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
            AI unavailable — baseline rules used
          </span>
        ) : null}
        {!resp.aiConfigured ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
            Set ANTHROPIC_API_KEY to enable AI commentary
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  tone,
  wide,
}: {
  title: string;
  items: string[];
  tone: "green" | "amber" | "blue" | "slate";
  wide?: boolean;
}) {
  const style = {
    green: "border-green-200 bg-green-50",
    amber: "border-amber-200 bg-amber-50",
    blue: "border-blue-200 bg-blue-50",
    slate: "border-slate-200 bg-white",
  }[tone];
  const labelColor = {
    green: "text-green-800",
    amber: "text-amber-800",
    blue: "text-blue-800",
    slate: "text-slate-800",
  }[tone];
  return (
    <div className={`${wide ? "md:col-span-2" : ""} rounded-lg border p-3 ${style}`}>
      <div className={`text-xs font-semibold ${labelColor}`}>{title}</div>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
        {items.map((item, i) => (
          <li key={i} className="leading-6">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
