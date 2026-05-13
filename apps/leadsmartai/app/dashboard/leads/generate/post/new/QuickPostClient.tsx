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

type MediaItem = {
  id: string;
  storagePath: string;
  signedUrl: string | null;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  label: string | null;
  createdAt: string;
};

/**
 * Connection shape from GET /api/leads-gen/connections (Phase 2A.2).
 * Renders the "Publish to Facebook/Instagram" button + multi-Page
 * picker when an agent manages several Pages. When the agent has no
 * connections, the wizard falls back to the compose-URL share.
 */
type Connection = {
  id: string;
  platform: "meta";
  fbPageId: string | null;
  fbPageName: string | null;
  igBusinessUserId: string | null;
  igBusinessUsername: string | null;
  pictureUrl: string | null;
  canPublishFacebook: boolean;
  canPublishInstagram: boolean;
};

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
  // Image picker state — selected media item attaches to the post.
  // One image per draft. Persists across platform-tab switches
  // because the same image works for FB / IG / LI / X.
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Phase 2A.2 — connected social accounts (Meta Pages). When present
  // for the active platform, the share row swaps the compose-URL
  // button for a direct "Publish to Facebook/Instagram" button.
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    Partial<Record<Platform, string>>
  >({});
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<
    | { ok: true; postId: string; externalPostUrl: string | null; platform: Platform }
    | { ok: false; error: string }
    | null
  >(null);

  const currentDraft = drafts[platform] ?? null;
  const subject = useMemo(
    () => subjects.find((s) => s.id === subjectId) ?? null,
    [subjects, subjectId],
  );
  const briefConfig = trigger ? BRIEF_CONFIG[trigger] : null;

  // Connections that can publish on the currently-selected platform.
  // Phase 2A.2 supports Facebook + Instagram only — LinkedIn / X
  // still fall back to compose-URL share.
  const eligibleConnections = useMemo(() => {
    if (platform === "facebook") {
      return connections.filter((c) => c.canPublishFacebook);
    }
    if (platform === "instagram") {
      return connections.filter((c) => c.canPublishInstagram);
    }
    return [];
  }, [connections, platform]);
  const activeConnectionId =
    selectedConnectionId[platform] ?? eligibleConnections[0]?.id ?? null;
  const activeConnection =
    eligibleConnections.find((c) => c.id === activeConnectionId) ?? null;

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

  // Fetch the agent's connections once on mount. Failure here is
  // non-fatal — wizard falls back to compose-URL share when the
  // list is empty (same path as a no-connection state).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/leads-gen/connections")
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          connections?: Connection[];
        };
        if (cancelled) return;
        if (body.ok && Array.isArray(body.connections)) {
          setConnections(body.connections);
        }
      })
      .catch(() => {
        // Non-fatal — show compose-URL fallback instead.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Direct publish via Meta Graph API. Only available when:
  //   - the platform is facebook or instagram, AND
  //   - the agent has a connected Page that supports that platform
  // For X / LinkedIn (and unconnected accounts) the compose-URL
  // fallback below handles it.
  const publish = useCallback(async () => {
    if (!currentDraft || !activeConnection) return;
    if (platform !== "facebook" && platform !== "instagram") return;
    setPublishResult(null);
    setPublishing(true);
    try {
      const res = await fetch("/api/leads-gen/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          connectionId: activeConnection.id,
          caption: currentDraft.caption,
          hashtags: currentDraft.hashtags,
          mediaItemId: selectedMedia?.id ?? undefined,
          trigger: trigger ?? undefined,
          subjectKind: subject?.kind ?? undefined,
          subjectRefId: subject?.refId ?? undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        postId?: string;
        externalPostUrl?: string | null;
        error?: string;
      };
      if (!res.ok || !body.ok) {
        setPublishResult({
          ok: false,
          error: body.error ?? "Publish failed",
        });
        return;
      }
      setPublishResult({
        ok: true,
        postId: body.postId ?? "",
        externalPostUrl: body.externalPostUrl ?? null,
        platform,
      });
    } catch (e) {
      setPublishResult({
        ok: false,
        error: e instanceof Error ? e.message : "Publish failed",
      });
    } finally {
      setPublishing(false);
    }
  }, [currentDraft, activeConnection, platform, selectedMedia, trigger, subject]);

  // Reset publish result when the agent switches platforms or
  // re-generates the draft — stale "Published ✓" banner on a
  // freshly-regenerated caption would be misleading.
  useEffect(() => {
    setPublishResult(null);
  }, [platform, currentDraft?.caption]);

  // Lazy-load the library the first time the agent opens the picker.
  const ensureLibraryLoaded = useCallback(async () => {
    if (libraryLoading) return;
    setLibraryError(null);
    setLibraryLoading(true);
    try {
      const res = await fetch("/api/leads-gen/media/list");
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        items?: MediaItem[];
        error?: string;
      };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Failed to load");
      setLibrary(body.items ?? []);
    } catch (e) {
      setLibraryError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLibraryLoading(false);
    }
  }, [libraryLoading]);

  const uploadFile = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/leads-gen/media/upload", {
        method: "POST",
        body: form,
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        item?: MediaItem;
        error?: string;
      };
      if (!res.ok || !body.ok || !body.item) {
        throw new Error(body.error ?? "Upload failed");
      }
      // Prepend to the library list AND auto-select the upload so
      // the agent doesn't need an extra click to attach it.
      setLibrary((prev) => [body.item!, ...prev.filter((m) => m.id !== body.item!.id)]);
      setSelectedMedia(body.item);
      setShowLibrary(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const downloadSelectedImage = useCallback(async () => {
    if (!selectedMedia?.signedUrl) return;
    try {
      const res = await fetch(selectedMedia.signedUrl);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = selectedMedia.fileName || "post-image";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // Fallback: open the signed URL in a new tab and let the user save manually.
      window.open(selectedMedia.signedUrl, "_blank", "noopener,noreferrer");
    }
  }, [selectedMedia]);

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

                {/* Image picker. Single image per draft. The image
                    attaches to all platform tabs since the same hero
                    works for FB / IG / LI / X. Web compose URLs
                    don't actually let us attach images directly
                    (FB sharer reads OG tags from the URL it shares,
                    not from upload — Phase 2 fixes this by posting
                    via Meta's Graph API). For now the wizard
                    surfaces a "Save image" button on the share row
                    so the agent has the file ready when they paste
                    the caption into the native app / web compose. */}
                <ImagePicker
                  selected={selectedMedia}
                  showLibrary={showLibrary}
                  library={library}
                  libraryLoading={libraryLoading}
                  libraryError={libraryError}
                  uploading={uploading}
                  onOpenLibrary={async () => {
                    setShowLibrary(true);
                    await ensureLibraryLoaded();
                  }}
                  onCloseLibrary={() => setShowLibrary(false)}
                  onSelect={(m) => {
                    setSelectedMedia(m);
                    setShowLibrary(false);
                  }}
                  onClear={() => setSelectedMedia(null)}
                  onUpload={uploadFile}
                />

                {/* Multi-Page picker — only renders when the agent
                    manages several Pages that can post on this
                    platform. Single connection auto-selects. */}
                {eligibleConnections.length > 1 && activeConnection && (
                  <div className="flex items-center gap-2 text-xs">
                    <label className="text-gray-600">Post to:</label>
                    <select
                      value={activeConnection.id}
                      onChange={(e) =>
                        setSelectedConnectionId((prev) => ({
                          ...prev,
                          [platform]: e.target.value,
                        }))
                      }
                      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
                    >
                      {eligibleConnections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {platform === "instagram" && c.igBusinessUsername
                            ? `@${c.igBusinessUsername}`
                            : c.fbPageName ?? "Connected Page"}
                        </option>
                      ))}
                    </select>
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

                  {selectedMedia && (
                    <button
                      type="button"
                      onClick={downloadSelectedImage}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Save image
                    </button>
                  )}

                  <span className="flex-1" />

                  {/* Three mutually-exclusive paths for the primary
                      action button:
                        1. Eligible connection exists → direct publish via Meta Graph API
                        2. Compose URL available    → opens platform's native compose
                        3. Neither                  → hint
                  */}
                  {activeConnection &&
                  (platform === "facebook" || platform === "instagram") ? (
                    <button
                      type="button"
                      onClick={publish}
                      disabled={publishing || !currentDraft?.caption.trim()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {publishing
                        ? "Publishing…"
                        : `Publish to ${PLATFORM_TABS.find((p) => p.id === platform)?.label}`}
                    </button>
                  ) : compose && compose.composeUrl ? (
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
                        ? "Instagram has no web compose — copy the caption, save the image, and post from the IG app. Or connect a Page to publish directly."
                        : "Direct share unavailable on this platform"}
                    </span>
                  )}
                </div>

                {/* Result banner for direct publishes. IIFE wraps the
                    narrowing in early-return form so TS narrows the
                    discriminated union reliably under stricter
                    settings (the nested-ternary form failed Vercel's
                    typecheck in #399). */}
                {(() => {
                  const result = publishResult;
                  if (!result) return null;
                  if (result.ok === true) {
                    return (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
                        <p className="font-semibold">
                          Published to{" "}
                          {PLATFORM_TABS.find((p) => p.id === result.platform)?.label} ✓
                        </p>
                        {result.externalPostUrl && (
                          <p className="mt-0.5">
                            <a
                              href={result.externalPostUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-emerald-700"
                            >
                              View the post →
                            </a>
                          </p>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
                      <p className="font-semibold">Publish failed</p>
                      <p className="mt-0.5">{result.error}</p>
                    </div>
                  );
                })()}

                {/* When no connections exist for this platform, nudge
                    the agent toward the Connect page. */}
                {!activeConnection &&
                  (platform === "facebook" || platform === "instagram") && (
                    <p className="text-xs text-gray-500">
                      Want one-click publish?{" "}
                      <a
                        href="/dashboard/leads/generate/connect"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-600 hover:underline"
                      >
                        Connect a Facebook Page
                      </a>{" "}
                      and we&apos;ll publish directly.
                    </p>
                  )}

                {compose && !compose.prefillsBody && compose.composeUrl && !activeConnection && (
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

/**
 * Image picker for the wizard's draft step. Three modes via the
 * `showLibrary` flag:
 *   - No selection, library closed: a compact "Add an image" prompt
 *     with two buttons (Upload / Library) and a Skip option.
 *   - Library open: grid of thumbnails from the media library
 *     (newest-first) + an Upload tile, agent picks one.
 *   - Selection made: hero preview + Change / Remove buttons.
 *
 * Drag-and-drop on the compact prompt is wired so a phone-snap
 * dragged from another tab uploads in one motion.
 */
function ImagePicker({
  selected,
  showLibrary,
  library,
  libraryLoading,
  libraryError,
  uploading,
  onOpenLibrary,
  onCloseLibrary,
  onSelect,
  onClear,
  onUpload,
}: {
  selected: MediaItem | null;
  showLibrary: boolean;
  library: MediaItem[];
  libraryLoading: boolean;
  libraryError: string | null;
  uploading: boolean;
  onOpenLibrary: () => void;
  onCloseLibrary: () => void;
  onSelect: (m: MediaItem) => void;
  onClear: () => void;
  onUpload: (file: File) => void;
}) {
  const inputId = "lead-media-upload";

  if (selected) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
        <div className="flex items-start gap-3">
          {selected.signedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selected.signedUrl}
              alt={selected.label ?? selected.fileName ?? "Selected image"}
              className="h-20 w-20 shrink-0 rounded-lg object-cover ring-1 ring-gray-200"
            />
          ) : (
            <div className="h-20 w-20 shrink-0 rounded-lg bg-gray-200" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {selected.label ?? selected.fileName ?? "Image attached"}
            </div>
            <div className="text-xs text-gray-500">
              {selected.contentType ?? "image"}
              {selected.sizeBytes != null
                ? ` · ${formatBytes(selected.sizeBytes)}`
                : ""}
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={onOpenLibrary}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Change
              </button>
              <button
                type="button"
                onClick={onClear}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showLibrary) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Your library</h3>
          <button
            type="button"
            onClick={onCloseLibrary}
            className="text-xs text-gray-500 hover:text-gray-900"
          >
            Close
          </button>
        </div>
        {libraryError ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {libraryError}
          </p>
        ) : libraryLoading ? (
          <p className="text-xs text-gray-500">Loading…</p>
        ) : library.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center">
            <p className="text-xs text-gray-500">
              Your library is empty. Upload an image to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {library.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m)}
                className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100 hover:border-blue-400"
                title={m.label ?? m.fileName ?? "Library image"}
              >
                {m.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.signedUrl}
                    alt={m.label ?? m.fileName ?? "Library image"}
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  />
                ) : null}
              </button>
            ))}
          </div>
        )}

        <label
          htmlFor={inputId}
          className="block cursor-pointer rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/60 px-3 py-3 text-center text-xs text-gray-600 hover:border-blue-400 hover:bg-blue-50/30"
        >
          {uploading ? "Uploading…" : "Upload a new image (JPG / PNG / WEBP, ≤ 20 MB)"}
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    );
  }

  // Compact "Add an image" prompt.
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) onUpload(f);
      }}
      className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50/60 px-3 py-2.5 text-xs"
    >
      <span className="text-gray-600">
        <span className="font-medium text-gray-900">Add an image</span> —
        attach a photo so you have it ready when sharing. Optional.
      </span>
      <div className="flex shrink-0 gap-2">
        <label
          htmlFor={inputId}
          className="cursor-pointer rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {uploading ? "Uploading…" : "Upload"}
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          onClick={onOpenLibrary}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Library
        </button>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
