"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { buildComposeInstruction, type ComposeInstruction } from "@/lib/leads-gen/share";

/**
 * Quick Post wizard — three steps on a single page so the agent can
 * see all of their inputs at once and tweak mid-stream without
 * losing context.
 *
 *   1. Pick a trigger (7 options post-Phase 1B)
 *   2. Pick a subject (auto-populated from the agent's CRM for
 *      listing-anchored triggers; free-text brief for the others)
 *   3. AI drafts a caption per target platform → inline edit →
 *      share button opens the platform's native compose with the
 *      caption pre-filled (or copy-and-paste for Instagram /
 *      LinkedIn body since those platforms don't support web
 *      compose prefill — see lib/leads-gen/share.ts)
 *
 * Deep-linking: the landing page's "Suggested this week" cards link
 * to this wizard with `?trigger=…&subjectId=…` so the picker steps
 * are skipped and the agent lands on the draft step. See the
 * `useSearchParams` effect below.
 *
 * State machine intentionally minimal — three independent slices
 * (trigger / subject / draft) instead of one giant reducer. The
 * draft is keyed by platform so the agent can switch tabs and the
 * previously-generated draft is still there when they come back.
 */

type Trigger =
  | "new_listing"
  | "open_house"
  | "price_drop"
  | "just_sold"
  | "market_update"
  | "testimonial"
  | "custom";

type SubjectKind =
  | "listing"
  | "open_house"
  | "transaction"
  | "market_update"
  | "testimonial"
  | "custom";

type Subject = {
  id: string;
  label: string;
  sub: string | null;
  kind: SubjectKind;
  refId: string | null;
};

type Platform = "facebook" | "instagram" | "linkedin" | "x";

type DraftResponse = {
  ok: boolean;
  caption?: string;
  hashtags?: string[];
  compose?: ComposeInstruction;
  subject?: {
    kind: SubjectKind;
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
    id: "price_drop",
    label: "Price drop",
    icon: "📉",
    hint: "Re-introduce a listing at a new price",
  },
  {
    id: "just_sold",
    label: "Just sold",
    icon: "🎉",
    hint: "Celebrate a deal you just closed",
  },
  {
    id: "market_update",
    label: "Market update",
    icon: "📊",
    hint: "Share an observation about your local market",
  },
  {
    id: "testimonial",
    label: "Testimonial",
    icon: "💬",
    hint: "Style a client quote into a polished post",
  },
  {
    id: "custom",
    label: "Custom",
    icon: "✨",
    hint: "Write your own brief, AI drafts the post",
  },
];

/**
 * Per-trigger brief field config. The brief field's role changes by
 * trigger — for listing-anchored triggers it's optional flavor; for
 * the synthetic triggers (custom / market_update / testimonial) it's
 * the only context the model has.
 *
 * The wizard renders the brief input differently based on this — for
 * the synthetic triggers it shows up in step 2 (mandatory before
 * advancing to step 3); for the listing triggers it shows up under
 * the subject picker as an optional "Add an angle" disclosure.
 */
const BRIEF_CONFIG: Record<
  Trigger,
  {
    /** Brief is required to generate a draft. */
    required: boolean;
    /** Placeholder text in the textarea. */
    placeholder: string;
    /** Help text shown under the field. */
    help: string;
    /** Step-2 panel: should the picker render or just a brief field? */
    step2Mode: "picker" | "brief";
  }
> = {
  new_listing: {
    required: false,
    placeholder:
      "Optional — what's the standout feature? (e.g. 'beautifully updated kitchen, sun-drenched backyard, walk to the village')",
    help: "Optional. Specific details make the post sound less generic.",
    step2Mode: "picker",
  },
  open_house: {
    required: false,
    placeholder:
      "Optional — anything special about the home or the open house (e.g. 'brand-new bathroom, light bites & coffee provided')",
    help: "Optional. Mention staging, refreshments, or unique features if any.",
    step2Mode: "picker",
  },
  price_drop: {
    required: false,
    placeholder:
      "Optional — old price + reason (e.g. 'Down from $1.45M to $1.39M — motivated seller, fast close possible')",
    help: "Mention the previous price if you want it referenced. AI will not invent numbers.",
    step2Mode: "picker",
  },
  just_sold: {
    required: false,
    placeholder:
      "Optional — anything special (e.g. 'closed in 14 days, multiple offers, repeat client')",
    help: "Optional. Skip client names unless they've explicitly OK'd a public mention.",
    step2Mode: "picker",
  },
  market_update: {
    required: true,
    placeholder:
      "What's the angle? (e.g. 'Inventory in Pasadena is up 18% MoM, rates have eased below 6.5% — buyers who paused are back')",
    help: "Specific data points produce better posts than generic 'the market is changing'.",
    step2Mode: "brief",
  },
  testimonial: {
    required: true,
    placeholder:
      "Paste the client quote verbatim, plus their first name if you have it (e.g. 'Sarah: \"Mike made the whole process feel easy — we closed in under 30 days and he negotiated $15k off the asking.\"')",
    help: "AI will use the quote verbatim. Add the client's first name if they've consented to public mention.",
    step2Mode: "brief",
  },
  custom: {
    required: true,
    placeholder:
      "Describe what the post should say — angle, tone, any specifics worth including.",
    help: "Be specific — names, neighborhoods, numbers, and angles help AI write a post that doesn't sound generic.",
    step2Mode: "brief",
  },
};

const PLATFORM_TABS: { id: Platform; label: string }[] = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "x", label: "X" },
];

const TRIGGER_IDS = new Set<Trigger>([
  "new_listing",
  "open_house",
  "price_drop",
  "just_sold",
  "market_update",
  "testimonial",
  "custom",
]);

export default function QuickPostClient() {
  const searchParams = useSearchParams();
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  /** Set true once we've consumed `?trigger=...&subjectId=...` so the trigger-change effect doesn't blow away the pre-selected subject. */
  const [hydratedFromQuery, setHydratedFromQuery] = useState(false);
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
  const briefConfig = trigger ? BRIEF_CONFIG[trigger] : null;

  // Hydrate trigger + subject from URL on mount (deep-link from the
  // "Suggested this week" landing cards). Only runs once — subsequent
  // trigger changes are user-driven.
  useEffect(() => {
    if (hydratedFromQuery) return;
    const t = (searchParams?.get("trigger") ?? "").trim();
    if (t && (TRIGGER_IDS as Set<string>).has(t)) {
      setTrigger(t as Trigger);
    }
    setHydratedFromQuery(true);
  }, [searchParams, hydratedFromQuery]);

  // Load subjects when the trigger changes. If we deep-linked in with
  // a subjectId, pre-select it once the matching subject row arrives.
  useEffect(() => {
    if (!trigger) return;
    let cancelled = false;
    setSubjectsLoading(true);
    setSubjectsError(null);
    setSubjects([]);
    // Read the deep-link subjectId ONCE per trigger-change so a user
    // who switches triggers manually after deep-linking doesn't see
    // the stale subject re-applied.
    const deepLinkSubjectId = hydratedFromQuery
      ? (searchParams?.get("subjectId") ?? "").trim()
      : "";
    if (!deepLinkSubjectId) setSubjectId(null);
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
        const list = body.subjects ?? [];
        setSubjects(list);
        // Priority order for auto-select:
        //   1. Deep-link subjectId (from landing-card click)
        //   2. Single-option synthetic triggers (custom / market_update / testimonial)
        if (deepLinkSubjectId && list.some((s) => s.id === deepLinkSubjectId)) {
          setSubjectId(deepLinkSubjectId);
        } else if (
          (trigger === "custom" ||
            trigger === "market_update" ||
            trigger === "testimonial") &&
          list.length === 1
        ) {
          setSubjectId(list[0].id);
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
    // searchParams intentionally captured at trigger-change time —
    // we don't want subsequent param mutations to retrigger the fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {TRIGGER_OPTIONS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTrigger(t.id);
                // Reset brief when switching triggers since the
                // placeholder text + required-ness changes per trigger;
                // a stale brief from a prior trigger is rarely useful.
                setBrief("");
              }}
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

      {/* Step 2 — Subject + optional brief
          Two modes per trigger config:
            - "picker": show the CRM-backed subject list. Brief is an
              optional disclosure-style accordion under it.
            - "brief": no picker — just the brief textarea (it IS the
              subject). The synthetic subject id is auto-selected when
              the user types content.
      */}
      {trigger && briefConfig && (
        <Section
          n={2}
          title={briefConfig.step2Mode === "brief" ? "What's the brief?" : "Which one?"}
          subtitle={
            briefConfig.step2Mode === "brief"
              ? "AI writes the post directly from your brief."
              : trigger === "new_listing"
                ? "Pick a listing from the last 60 days."
                : trigger === "open_house"
                  ? "Pick an upcoming open house."
                  : trigger === "price_drop"
                    ? "Pick the listing you're re-pricing."
                    : "Pick a recent closing to celebrate."
          }
        >
          {briefConfig.step2Mode === "brief" ? (
            <BriefInput
              value={brief}
              onChange={setBrief}
              placeholder={briefConfig.placeholder}
              help={briefConfig.help}
              required={briefConfig.required}
              onCommit={() => {
                // Sync the synthetic subject id once a brief is typed.
                if (trigger === "custom") setSubjectId("custom");
                else if (trigger === "market_update") setSubjectId("market_update");
                else if (trigger === "testimonial") setSubjectId("testimonial");
              }}
              committed={subjectId !== null}
            />
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
              {emptyStateMessage(trigger)}
            </div>
          ) : (
            <>
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

              {/* Optional brief disclosure — picker triggers offer an
                  "Add an angle" expander where the agent can pass
                  flavor (e.g. old price for a drop, multiple-offers
                  for a just-sold) to the model. */}
              {subjectId && (
                <details className="mt-4 rounded-lg border border-gray-200 bg-gray-50/60">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-gray-700 hover:text-gray-900">
                    Add an angle (optional)
                  </summary>
                  <div className="border-t border-gray-200 px-3 py-3">
                    <BriefInput
                      value={brief}
                      onChange={setBrief}
                      placeholder={briefConfig.placeholder}
                      help={briefConfig.help}
                      required={false}
                      onCommit={() => {}}
                      committed={false}
                      inline
                    />
                  </div>
                </details>
              )}
            </>
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

/**
 * Brief textarea + help text. Two visual modes:
 *   - Standalone (`inline` false): full input + "Use this brief" button
 *     that commits the synthetic subject id. Used in step-2 "brief" mode
 *     (custom / market_update / testimonial).
 *   - Inline (`inline` true): just the textarea, no commit button. Used
 *     inside the "Add an angle" disclosure on listing-anchored triggers.
 */
function BriefInput({
  value,
  onChange,
  placeholder,
  help,
  required,
  onCommit,
  committed,
  inline,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  help: string;
  required: boolean;
  onCommit: () => void;
  committed: boolean;
  inline?: boolean;
}) {
  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={inline ? 3 : 4}
        className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
      <p className="text-xs text-gray-500">{help}</p>
      {!inline && (
        <button
          type="button"
          onClick={onCommit}
          disabled={(required && !value.trim()) || committed}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {committed ? "Brief saved" : "Use this brief"}
        </button>
      )}
    </div>
  );
}

function emptyStateMessage(trigger: Trigger): string {
  switch (trigger) {
    case "new_listing":
      return "No listings from the last 60 days. Create a listing first, or use the Custom option.";
    case "open_house":
      return "No upcoming open houses in the next 21 days. Schedule one, or use the Custom option.";
    case "price_drop":
      return "No active listings to re-price. Add or activate a listing first.";
    case "just_sold":
      return "No transactions closed in the last 60 days. Use the Custom option to draft a general celebration post.";
    default:
      return "Nothing to pick here — use the Custom option.";
  }
}
