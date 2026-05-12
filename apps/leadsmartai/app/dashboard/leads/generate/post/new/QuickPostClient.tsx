"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { buildComposeInstruction, type ComposeInstruction } from "@/lib/leads-gen/share";

/**
 * Quick Post wizard — three steps on a single page so the agent can
 * see all of their inputs at once and tweak mid-stream without
 * losing context.
 *
 *   1. Pick a trigger (new listing / open house / custom)
 *   2. Pick a subject (auto-populated from the agent's CRM for
 *      listing & open-house triggers; free-text brief for custom)
 *   3. AI drafts a caption per target platform → inline edit →
 *      share button opens the platform's native compose with the
 *      caption pre-filled (or copy-and-paste for Instagram /
 *      LinkedIn body since those platforms don't support web
 *      compose prefill — see lib/leads-gen/share.ts)
 *
 * State machine intentionally minimal — three independent slices
 * (trigger / subject / draft) instead of one giant reducer. The
 * draft is keyed by platform so the agent can switch tabs and the
 * previously-generated draft is still there when they come back.
 */

type Trigger = "new_listing" | "open_house" | "custom";

type Subject = {
  id: string;
  label: string;
  sub: string | null;
  kind: "listing" | "open_house" | "custom";
  refId: string | null;
};

type Platform = "facebook" | "instagram" | "linkedin" | "x";

type DraftResponse = {
  ok: boolean;
  caption?: string;
  hashtags?: string[];
  compose?: ComposeInstruction;
  subject?: {
    kind: "listing" | "open_house" | "custom";
    refId: string | null;
    property_address: string | null;
    list_price: number | null;
  };
  error?: string;
};

type DraftState = {
  caption: string;
  hashtags: string[];
  /** Original AI caption — used by "Regenerate" to detect agent edits. */
  originalCaption: string;
  shareUrl: string | null;
};

const TRIGGER_OPTIONS: { id: Trigger; label: string; icon: string; hint: string }[] = [
  {
    id: "new_listing",
    label: "New listing",
    icon: "🏠",
    hint: "Announce a property you just listed",
  },
  {
    id: "open_house",
    label: "Open house",
    icon: "📅",
    hint: "Promote an upcoming open house",
  },
  {
    id: "custom",
    label: "Custom",
    icon: "✨",
    hint: "Write your own brief, AI drafts the post",
  },
];

const PLATFORM_TABS: { id: Platform; label: string }[] = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "x", label: "X" },
];

export default function QuickPostClient() {
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [brief, setBrief] = useState("");
  const [platform, setPlatform] = useState<Platform>("facebook");
  // Drafts keyed by platform so switching tabs doesn't drop work.
  const [drafts, setDrafts] = useState<Partial<Record<Platform, DraftState>>>({});
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentDraft = drafts[platform] ?? null;
  const subject = useMemo(
    () => subjects.find((s) => s.id === subjectId) ?? null,
    [subjects, subjectId],
  );

  // Load subjects when the trigger changes.
  useEffect(() => {
    if (!trigger) return;
    let cancelled = false;
    setSubjectsLoading(true);
    setSubjectsError(null);
    setSubjects([]);
    setSubjectId(null);
    fetch(`/api/leads-gen/subjects?trigger=${encodeURIComponent(trigger)}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          subjects?: Subject[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !body.ok) {
          throw new Error(body.error ?? "Failed to load subjects");
        }
        setSubjects(body.subjects ?? []);
        // Auto-select the only option for "custom" so the agent
        // doesn't have to click through a one-item list.
        if (trigger === "custom" && body.subjects?.length === 1) {
          setSubjectId(body.subjects[0].id);
        }
      })
      .catch((e) => {
        if (!cancelled) setSubjectsError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setSubjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trigger]);

  const generate = useCallback(async () => {
    if (!trigger || !subjectId) return;
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch("/api/leads-gen/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger,
          subjectId,
          platform,
          brief: brief.trim() || null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as DraftResponse;
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Draft failed");
      setDrafts((prev) => ({
        ...prev,
        [platform]: {
          caption: body.caption ?? "",
          hashtags: body.hashtags ?? [],
          originalCaption: body.caption ?? "",
          shareUrl: body.compose?.shareUrl ?? null,
        },
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setDrafting(false);
    }
  }, [trigger, subjectId, platform, brief]);

  const updateCaption = useCallback(
    (next: string) => {
      setDrafts((prev) => ({
        ...prev,
        [platform]: prev[platform]
          ? { ...prev[platform]!, caption: next }
          : prev[platform],
      }));
    },
    [platform],
  );

  const compose: ComposeInstruction | null = useMemo(() => {
    if (!currentDraft) return null;
    return buildComposeInstruction({
      platform,
      caption: currentDraft.caption,
      hashtags: currentDraft.hashtags,
      shareUrl: currentDraft.shareUrl,
    });
  }, [currentDraft, platform]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Quick Post</h1>
          <p className="text-sm text-gray-500">
            AI drafts a social post in seconds. Edit, then share.
          </p>
        </div>
        <Link
          href="/dashboard/leads/generate"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          &larr; Back
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Step 1 — Trigger */}
      <Section
        n={1}
        title="What's this about?"
        subtitle="Pick the angle of your post."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {TRIGGER_OPTIONS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTrigger(t.id)}
              className={`group rounded-xl border p-4 text-left transition ${
                trigger === t.id
                  ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                  : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30"
              }`}
            >
              <div className="text-2xl">{t.icon}</div>
              <div className="mt-2 text-sm font-semibold text-gray-900">{t.label}</div>
              <div className="mt-0.5 text-xs text-gray-500">{t.hint}</div>
            </button>
          ))}
        </div>
      </Section>

      {/* Step 2 — Subject */}
      {trigger && (
        <Section
          n={2}
          title={trigger === "custom" ? "What's the brief?" : "Which one?"}
          subtitle={
            trigger === "custom"
              ? "Describe what the post should say — AI will draft it."
              : trigger === "new_listing"
                ? "Pick a listing from the last 60 days."
                : "Pick an upcoming open house."
          }
        >
          {trigger === "custom" ? (
            <div className="space-y-2">
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="e.g. 'Share a quick market update — interest rates are easing, more buyer activity in West LA, encourage sellers to list before fall'"
                rows={4}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="text-xs text-gray-500">
                Be specific — names, neighborhoods, numbers, and angles help AI write a post that doesn&apos;t sound generic.
              </p>
              <button
                type="button"
                onClick={() => setSubjectId("custom")}
                disabled={!brief.trim() || subjectId === "custom"}
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {subjectId === "custom" ? "Brief saved" : "Use this brief"}
              </button>
            </div>
          ) : subjectsLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
              Loading…
            </div>
          ) : subjectsError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {subjectsError}
            </p>
          ) : subjects.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              {trigger === "new_listing"
                ? "No listings from the last 60 days. Create a listing first, or use the Custom option."
                : "No upcoming open houses in the next 21 days. Schedule one, or use the Custom option."}
            </div>
          ) : (
            <div className="space-y-2">
              {subjects.map((s) => (
                <label
                  key={s.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                    subjectId === s.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-blue-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="subject"
                    value={s.id}
                    checked={subjectId === s.id}
                    onChange={() => setSubjectId(s.id)}
                    className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{s.label}</div>
                    {s.sub && <div className="text-xs text-gray-500">{s.sub}</div>}
                  </div>
                </label>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Step 3 — Draft + share */}
      {subjectId && (
        <Section
          n={3}
          title="Draft + share"
          subtitle="AI writes a platform-specific caption. Edit anything before sharing."
        >
          <div className="space-y-3">
            <div className="flex items-center gap-1 border-b border-gray-200">
              {PLATFORM_TABS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(p.id)}
                  className={`px-3 py-1.5 text-sm font-medium transition border-b-2 -mb-px ${
                    platform === p.id
                      ? "border-blue-600 text-blue-700"
                      : "border-transparent text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {!currentDraft ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-6 text-center">
                <p className="text-sm text-gray-600">
                  No draft yet for{" "}
                  <span className="font-medium text-gray-900">
                    {PLATFORM_TABS.find((p) => p.id === platform)?.label}
                  </span>
                  .
                </p>
                <button
                  type="button"
                  onClick={generate}
                  disabled={drafting}
                  className="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {drafting ? "Drafting..." : "Generate draft"}
                </button>
              </div>
            ) : (
              <>
                <textarea
                  value={currentDraft.caption}
                  onChange={(e) => updateCaption(e.target.value)}
                  rows={8}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {currentDraft.hashtags.length > 0 && platform !== "instagram" && (
                  <div className="flex flex-wrap gap-1.5">
                    {currentDraft.hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={generate}
                    disabled={drafting}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {drafting ? "Regenerating..." : "↻ Regenerate"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText(currentDraft.caption).catch(() => {})
                    }
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Copy caption
                  </button>

                  <span className="flex-1" />

                  {compose && compose.composeUrl ? (
                    <a
                      href={compose.composeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Share to {PLATFORM_TABS.find((p) => p.id === platform)?.label}
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.5 4.5l7.5 7.5-7.5 7.5"
                        />
                      </svg>
                    </a>
                  ) : (
                    <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-600">
                      {platform === "instagram"
                        ? "Instagram has no web compose — copy the caption above, save the image, and post from the IG app."
                        : "Direct share unavailable on this platform"}
                    </span>
                  )}
                </div>

                {compose && !compose.prefillsBody && compose.composeUrl && (
                  <p className="text-xs text-amber-700">
                    {platform === "linkedin"
                      ? "LinkedIn's share dialog only honors the link — the body won't pre-fill. Tap Copy caption first, then paste into the LinkedIn compose."
                      : "Caption won't pre-fill — copy it first."}
                  </p>
                )}
              </>
            )}
          </div>
        </Section>
      )}

      {/* Footer hint — explains the next phase so the agent knows what's coming */}
      {subjectId && (
        <p className="text-xs text-gray-400">
          Phase 1: opens the platform&apos;s compose dialog with your caption.
          Phase 2 (in ~4 weeks) will post directly after one-time
          authorization — no extra click required.
        </p>
      )}
    </div>
  );
}

function Section({
  n,
  title,
  subtitle,
  children,
}: {
  n: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
          {n}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
