"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Lead Ad campaign wizard. Single-page, four sections:
 *
 *   1. Where it runs   — connection + ad account
 *   2. Who sees it     — geo + age range
 *   3. What it says    — body + headline + image + lead form
 *   4. Budget + launch — daily $ + duration + launch-immediately
 *
 * Each section gates the next: section 2 won't render until a
 * connection + ad account are picked, etc. Keeps the page short on
 * the agent's first pass and avoids the "tell me everything before
 * I let you click anything" anti-pattern.
 *
 * Submit posts to /api/leads-gen/ads/create which orchestrates 6
 * Meta API calls. Default is to create PAUSED so the agent can do
 * a final review in Meta Ads Manager before money starts moving.
 *
 * Deep-link via `?connectionId=...&subjectAddress=...` from a
 * future "Run Ads on this listing" affordance — for now the
 * params are unused; the wizard works from a cold start.
 */

type Connection = {
  id: string;
  platform: "meta";
  fbPageId: string | null;
  fbPageName: string | null;
  igBusinessUsername: string | null;
  pictureUrl: string | null;
  canPublishFacebook: boolean;
  canPublishInstagram: boolean;
};

type AdAccount = {
  id: string; // 'act_<digits>'
  accountId: string;
  name: string | null;
  currency: string | null;
  isActive: boolean;
};

type MediaItem = {
  id: string;
  signedUrl: string | null;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
};

type FormQuestion =
  | "FULL_NAME"
  | "FIRST_NAME"
  | "LAST_NAME"
  | "EMAIL"
  | "PHONE"
  | "STREET_ADDRESS"
  | "CITY"
  | "STATE"
  | "ZIP_CODE";

const FORM_QUESTION_LABELS: Record<FormQuestion, string> = {
  FULL_NAME: "Full name",
  FIRST_NAME: "First name",
  LAST_NAME: "Last name",
  EMAIL: "Email",
  PHONE: "Phone number",
  STREET_ADDRESS: "Street address",
  CITY: "City",
  STATE: "State",
  ZIP_CODE: "ZIP code",
};

const DEFAULT_QUESTIONS: FormQuestion[] = ["FULL_NAME", "EMAIL", "PHONE"];

type LaunchResult = {
  campaignId: string;
  meta: {
    campaignId: string;
    adSetId: string;
    creativeId: string;
    adId: string;
    formId: string;
  };
  status: "paused" | "active";
};

export default function AdCampaignWizardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Connection + ad account ──────────────────────────────────────
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [adAccountsLoading, setAdAccountsLoading] = useState(false);
  const [adAccountId, setAdAccountId] = useState<string | null>(null);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  // ── Audience ─────────────────────────────────────────────────────
  const [zipCodes, setZipCodes] = useState("");
  const [radiusMiles, setRadiusMiles] = useState(15);
  const [ageMin, setAgeMin] = useState(25);
  const [ageMax, setAgeMax] = useState(65);

  // ── Creative ─────────────────────────────────────────────────────
  const [campaignName, setCampaignName] = useState("");
  const [adBody, setAdBody] = useState("");
  const [adHeadline, setAdHeadline] = useState("");
  const [landingUrl, setLandingUrl] = useState("https://www.leadsmart-ai.com/contact");
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<FormQuestion[]>(DEFAULT_QUESTIONS);

  // ── Budget + schedule ────────────────────────────────────────────
  const [dailyBudget, setDailyBudget] = useState(20);
  const [durationDays, setDurationDays] = useState(7);
  const [launchImmediately, setLaunchImmediately] = useState(false);

  // ── Submit ───────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LaunchResult | null>(null);

  // Selected derived state
  const connection = useMemo(
    () => connections.find((c) => c.id === connectionId) ?? null,
    [connections, connectionId],
  );
  const adAccount = useMemo(
    () => adAccounts.find((a) => a.id === adAccountId) ?? null,
    [adAccounts, adAccountId],
  );
  const selectedMedia = useMemo(
    () => library.find((m) => m.id === selectedMediaId) ?? null,
    [library, selectedMediaId],
  );

  // Load connections + library once on mount.
  useEffect(() => {
    let cancelled = false;
    setConnectionsLoading(true);
    fetch("/api/leads-gen/connections")
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          connections?: Connection[];
        };
        if (cancelled) return;
        if (body.ok && Array.isArray(body.connections)) {
          const meta = body.connections.filter((c) => c.platform === "meta");
          setConnections(meta);
          // Auto-pick if there's exactly one connection, or honor
          // the deep-link param.
          const fromQuery = (searchParams?.get("connectionId") ?? "").trim();
          if (fromQuery && meta.some((c) => c.id === fromQuery)) {
            setConnectionId(fromQuery);
          } else if (meta.length === 1) {
            setConnectionId(meta[0].id);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setConnectionsLoading(false);
      });

    setLibraryLoading(true);
    fetch("/api/leads-gen/media/list")
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          items?: MediaItem[];
        };
        if (cancelled) return;
        if (body.ok && Array.isArray(body.items)) {
          setLibrary(body.items);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLibraryLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load ad accounts when connection changes.
  useEffect(() => {
    if (!connectionId) {
      setAdAccounts([]);
      setAdAccountId(null);
      return;
    }
    let cancelled = false;
    setAdAccountsLoading(true);
    setAccountsError(null);
    setAdAccounts([]);
    setAdAccountId(null);
    fetch(
      `/api/leads-gen/ads/accounts?connectionId=${encodeURIComponent(connectionId)}`,
    )
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          accounts?: AdAccount[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !body.ok) {
          throw new Error(body.error ?? "Failed to load ad accounts");
        }
        setAdAccounts(body.accounts ?? []);
        const activeOnes = (body.accounts ?? []).filter((a) => a.isActive);
        if (activeOnes.length === 1) {
          setAdAccountId(activeOnes[0].id);
        }
      })
      .catch((e) => {
        if (!cancelled) setAccountsError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setAdAccountsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [connectionId]);

  const toggleQuestion = useCallback((q: FormQuestion) => {
    setQuestions((prev) =>
      prev.includes(q) ? prev.filter((x) => x !== q) : [...prev, q],
    );
  }, []);

  const launch = useCallback(async () => {
    if (!connection || !adAccount || !selectedMedia) return;
    setError(null);
    setSubmitting(true);
    try {
      const zips = zipCodes
        .split(/[,\s]+/)
        .map((z) => z.trim())
        .filter((z) => /^\d{5}$/.test(z));
      const startTime = new Date().toISOString();
      const endTime = new Date(
        Date.now() + durationDays * 24 * 60 * 60 * 1000,
      ).toISOString();

      const res = await fetch("/api/leads-gen/ads/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: connection.id,
          adAccountId: adAccount.id,
          name: campaignName.trim() || `Lead Ad — ${new Date().toLocaleDateString()}`,
          body: adBody,
          headline: adHeadline.trim() || undefined,
          mediaItemId: selectedMedia.id,
          formQuestions: questions,
          landingUrl,
          targeting: {
            countries: ["US"],
            zipCodes: zips.length > 0 ? zips : undefined,
            radiusMiles: zips.length > 0 ? radiusMiles : undefined,
            ageMin,
            ageMax,
          },
          dailyBudgetDollars: dailyBudget,
          startTime,
          endTime,
          launchImmediately,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        campaignId?: string;
        meta?: LaunchResult["meta"];
        status?: "paused" | "active";
        error?: string;
      };
      if (!res.ok || !body.ok || !body.campaignId || !body.meta || !body.status) {
        setError(body.error ?? "Campaign creation failed");
        return;
      }
      setResult({ campaignId: body.campaignId, meta: body.meta, status: body.status });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Campaign creation failed");
    } finally {
      setSubmitting(false);
    }
  }, [
    connection,
    adAccount,
    selectedMedia,
    zipCodes,
    durationDays,
    campaignName,
    adBody,
    adHeadline,
    questions,
    landingUrl,
    radiusMiles,
    ageMin,
    ageMax,
    dailyBudget,
    launchImmediately,
  ]);

  // Step gating
  const step1Complete = Boolean(connection && adAccount);
  const step2Complete = step1Complete; // audience has defaults — always "complete"
  const step3Complete =
    step2Complete &&
    Boolean(
      campaignName.trim() &&
        adBody.trim() &&
        selectedMedia &&
        questions.length > 0,
    );
  const canLaunch = step3Complete && dailyBudget >= 5 && durationDays >= 1;

  // ── Render ───────────────────────────────────────────────────────

  if (result) {
    return (
      <DoneState
        result={result}
        onAnother={() => {
          setResult(null);
          setError(null);
        }}
        onBack={() => router.push("/dashboard/leads/generate")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            New Lead Ad Campaign
          </h1>
          <p className="text-sm text-gray-500">
            Launch a Meta Lead Ad. Leads land directly in your CRM tagged with
            the campaign source.
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

      {/* Section 1 — Where it runs */}
      <Section
        n={1}
        title="Where it runs"
        subtitle="Pick a connected Facebook Page and an ad account."
      >
        {connectionsLoading ? (
          <p className="text-sm text-gray-500">Loading connections…</p>
        ) : connections.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            No Facebook Pages connected.{" "}
            <Link
              href="/dashboard/leads/generate/connect"
              className="font-medium underline hover:text-amber-700"
            >
              Connect a Page →
            </Link>
          </div>
        ) : (
          <>
            <label className="block text-xs font-medium text-gray-700">
              Page
            </label>
            <select
              value={connectionId ?? ""}
              onChange={(e) => setConnectionId(e.target.value || null)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Pick a Page…</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fbPageName ?? "Connected Page"}
                  {c.igBusinessUsername ? ` (+ IG @${c.igBusinessUsername})` : ""}
                </option>
              ))}
            </select>

            {connectionId && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-700">
                  Ad account
                </label>
                {adAccountsLoading ? (
                  <p className="mt-1 text-sm text-gray-500">Loading ad accounts…</p>
                ) : accountsError ? (
                  <p className="mt-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                    {accountsError}
                  </p>
                ) : adAccounts.length === 0 ? (
                  <p className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    No ad accounts found under this Page&apos;s Business Manager. Create one in Meta Business Settings.
                  </p>
                ) : (
                  <select
                    value={adAccountId ?? ""}
                    onChange={(e) => setAdAccountId(e.target.value || null)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Pick an ad account…</option>
                    {adAccounts.map((a) => (
                      <option key={a.id} value={a.id} disabled={!a.isActive}>
                        {a.name ?? a.accountId}
                        {a.currency ? ` (${a.currency})` : ""}
                        {!a.isActive ? " — inactive" : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </>
        )}
      </Section>

      {/* Section 2 — Audience */}
      {step1Complete && (
        <Section
          n={2}
          title="Who sees it"
          subtitle="Real-estate ads are HOUSING-restricted by Meta — only broad geo + age targeting allowed."
        >
          <div>
            <label className="block text-xs font-medium text-gray-700">
              ZIP codes (comma-separated)
            </label>
            <textarea
              value={zipCodes}
              onChange={(e) => setZipCodes(e.target.value)}
              rows={2}
              placeholder="90210, 90211, 90212"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <p className="mt-1 text-xs text-gray-500">
              Optional. Leave blank to target the entire US. Up to 50 zips.
            </p>
          </div>

          {zipCodes.trim() && (
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-700">
                Radius around each ZIP: {radiusMiles} mi
              </label>
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={radiusMiles}
                onChange={(e) => setRadiusMiles(Number(e.target.value))}
                className="mt-1 w-full"
              />
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Min age
              </label>
              <input
                type="number"
                min={18}
                max={65}
                value={ageMin}
                onChange={(e) =>
                  setAgeMin(Math.max(18, Math.min(65, Number(e.target.value) || 25)))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Max age
              </label>
              <input
                type="number"
                min={18}
                max={65}
                value={ageMax}
                onChange={(e) =>
                  setAgeMax(Math.max(18, Math.min(65, Number(e.target.value) || 65)))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </Section>
      )}

      {/* Section 3 — Creative + form */}
      {step2Complete && (
        <Section
          n={3}
          title="What it says"
          subtitle="The ad's body, image, headline, and what the lead form asks for."
        >
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Campaign name <span className="text-gray-400">(internal label)</span>
              </label>
              <input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder={`Lead Ad — ${new Date().toLocaleDateString()}`}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">
                Ad body
              </label>
              <textarea
                value={adBody}
                onChange={(e) => setAdBody(e.target.value)}
                rows={4}
                placeholder="2-3 sentences about the listing or the offer. What's the hook?"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">
                Headline <span className="text-gray-400">(optional, ≤ 40 chars)</span>
              </label>
              <input
                value={adHeadline}
                onChange={(e) => setAdHeadline(e.target.value)}
                placeholder='e.g. "Just listed in Pasadena"'
                maxLength={40}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">
                Landing URL <span className="text-gray-400">(where the lead form&apos;s &ldquo;Submit&rdquo; confirmation sends them)</span>
              </label>
              <input
                value={landingUrl}
                onChange={(e) => setLandingUrl(e.target.value)}
                placeholder="https://yoursite.com"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">
                Image
              </label>
              {libraryLoading ? (
                <p className="mt-1 text-sm text-gray-500">Loading library…</p>
              ) : library.length === 0 ? (
                <p className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Your media library is empty. Upload an image first — Meta requires one for Lead Ad creatives.
                </p>
              ) : (
                <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {library.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMediaId(m.id)}
                      className={`relative aspect-square overflow-hidden rounded-lg border ${
                        selectedMediaId === m.id
                          ? "border-blue-500 ring-2 ring-blue-100"
                          : "border-gray-200 hover:border-blue-300"
                      }`}
                      title={m.fileName ?? "Library image"}
                    >
                      {m.signedUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.signedUrl}
                          alt={m.fileName ?? ""}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-gray-100" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">
                Lead form questions
              </label>
              <p className="text-xs text-gray-500 mt-0.5 mb-2">
                Tick the fields you want each lead to fill in. Fewer = higher
                conversion; more = better-qualified leads.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(FORM_QUESTION_LABELS) as FormQuestion[]).map((q) => (
                  <label
                    key={q}
                    className="flex items-center gap-2 text-sm text-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={questions.includes(q)}
                      onChange={() => toggleQuestion(q)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {FORM_QUESTION_LABELS[q]}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* Section 4 — Budget + launch */}
      {step3Complete && (
        <Section
          n={4}
          title="Budget + launch"
          subtitle="Daily spend cap and how long the campaign runs."
        >
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Daily budget: ${dailyBudget}/day
              </label>
              <input
                type="range"
                min={5}
                max={100}
                step={5}
                value={dailyBudget}
                onChange={(e) => setDailyBudget(Number(e.target.value))}
                className="mt-1 w-full"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                <span>$5</span>
                <span>$100</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">
                Run for: {durationDays} {durationDays === 1 ? "day" : "days"}
              </label>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className="mt-1 w-full"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                <span>1d</span>
                <span>30d</span>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2.5 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-gray-600">Total budget</span>
                <span className="font-semibold text-gray-900">
                  ${dailyBudget * durationDays}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                Meta bills you directly. LeadSmart never touches your ad spend.
              </p>
            </div>

            <label className="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2.5">
              <input
                type="checkbox"
                checked={launchImmediately}
                onChange={(e) => setLaunchImmediately(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="text-sm">
                <span className="font-medium text-gray-900">
                  Launch immediately
                </span>
                <p className="text-xs text-gray-500">
                  Default is to create in <strong>paused</strong> state so you can
                  review in Meta Ads Manager before money starts moving.
                </p>
              </div>
            </label>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
              <Link
                href="/dashboard/leads/generate"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={launch}
                disabled={!canLaunch || submitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting
                  ? "Creating campaign…"
                  : launchImmediately
                    ? "Launch campaign"
                    : "Create paused campaign"}
              </button>
            </div>
          </div>
        </Section>
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

function DoneState({
  result,
  onAnother,
  onBack,
}: {
  result: LaunchResult;
  onAnother: () => void;
  onBack: () => void;
}) {
  const adsManagerUrl = `https://adsmanager.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${encodeURIComponent(result.meta.campaignId)}`;
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
          <svg
            className="h-5 w-5 text-emerald-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-emerald-900">
            Campaign created{result.status === "active" ? " and live" : " (paused)"}
          </h2>
          <p className="text-sm text-emerald-800">
            {result.status === "active"
              ? "Your Meta Lead Ad is now running. Leads will appear in your CRM as they come in."
              : "Your Meta Lead Ad was created in paused state. Review it in Meta Ads Manager, then unpause when you're ready."}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-mono text-emerald-900 space-y-0.5">
        <div>
          <span className="text-emerald-700">Campaign</span>{" "}
          {result.meta.campaignId}
        </div>
        <div>
          <span className="text-emerald-700">Ad set</span>{" "}
          {result.meta.adSetId}
        </div>
        <div>
          <span className="text-emerald-700">Ad</span> {result.meta.adId}
        </div>
        <div>
          <span className="text-emerald-700">Lead form</span>{" "}
          {result.meta.formId}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={adsManagerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Open in Meta Ads Manager →
        </a>
        <button
          type="button"
          onClick={onAnother}
          className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-50"
        >
          Create another
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-50"
        >
          Back to Generate Leads
        </button>
      </div>
    </div>
  );
}
