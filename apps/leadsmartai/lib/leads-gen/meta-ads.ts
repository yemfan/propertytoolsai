import "server-only";

import { META_GRAPH_BASE } from "./meta-oauth";

/**
 * Meta Marketing API helpers — ad account discovery + lead retrieval.
 *
 * The big campaign/adset/creative/ad creation surface lands in
 * Phase 2B.2. This module owns the bits Phase 2B.1 needs:
 *   - listAdAccountsForUser: ad-account picker in the wizard
 *   - fetchLeadByLeadgenId: webhook → field data → CRM insert
 *
 * All Meta-side errors get re-thrown with code + trace id tagged
 * on the Error so route handlers can surface them.
 */

type GraphError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_msg?: string;
  fbtrace_id?: string;
};

function tagError(err: Error, ge: GraphError | undefined): Error {
  if (ge) {
    Object.assign(err, {
      metaCode: ge.code ?? null,
      metaSubcode: ge.error_subcode ?? null,
      metaUserMessage: ge.error_user_msg ?? null,
      metaTraceId: ge.fbtrace_id ?? null,
    });
  }
  return err;
}

// ── Ad account discovery ─────────────────────────────────────────────

export type AdAccount = {
  id: string; // "act_<digits>"
  accountId: string; // digits only
  name: string | null;
  currency: string | null;
  timezone: string | null;
  /** account_status: 1=active, 2=disabled, 3=unsettled, 7=pending_risk_review, 8=pending_settlement, 9=in_grace_period, 100=pending_closure, 101=closed, 201=any_active, 202=any_closed */
  accountStatus: number | null;
  /** True when status is 1 (active) — the wizard only lets the agent pick from these. */
  isActive: boolean;
};

type AdAccountsResp = {
  data?: Array<{
    id?: string;
    account_id?: string;
    name?: string;
    currency?: string;
    timezone_name?: string;
    account_status?: number;
  }>;
  paging?: { next?: string };
  error?: GraphError;
};

/**
 * List all ad accounts the user can manage. Walks pagination so
 * brokerages with multiple ad accounts under one Business Manager
 * all show up in the picker.
 *
 * Token: a user access token (NOT a Page token) — ad-account
 * ownership lives at the user/business level, not the page level.
 * We use the `user_access_token_enc` column on social_accounts
 * (decrypted at call site) instead of the page token.
 */
export async function listAdAccountsForUser(
  userAccessToken: string,
): Promise<AdAccount[]> {
  const accounts: AdAccount[] = [];
  let url:
    | string
    | undefined = `${META_GRAPH_BASE}/me/adaccounts?fields=id,account_id,name,currency,timezone_name,account_status&access_token=${encodeURIComponent(
    userAccessToken,
  )}`;
  while (url) {
    const res = await fetch(url);
    const body = (await res.json().catch(() => ({}))) as AdAccountsResp;
    if (!res.ok) {
      const msg = body.error?.message || `HTTP ${res.status}`;
      throw tagError(
        new Error(`Meta /me/adaccounts failed: ${msg}`),
        body.error,
      );
    }
    for (const row of body.data ?? []) {
      if (!row.id) continue;
      accounts.push({
        id: row.id,
        accountId: row.account_id ?? row.id.replace(/^act_/, ""),
        name: row.name ?? null,
        currency: row.currency ?? null,
        timezone: row.timezone_name ?? null,
        accountStatus: row.account_status ?? null,
        isActive: row.account_status === 1,
      });
    }
    url = body.paging?.next;
  }
  // Active accounts first — agents typically have one active + a few
  // closed legacy ones, so sorting active-first means the right
  // pick is at the top of the dropdown.
  return accounts.sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });
}

// ── Lead retrieval ───────────────────────────────────────────────────

export type LeadFieldData = {
  /** Meta field key — for standard form fields this is one of:
   *  full_name | first_name | last_name | email | phone_number |
   *  street_address | city | state | zip_code | country | ... */
  name: string;
  values: string[];
};

export type RetrievedLead = {
  leadgenId: string;
  adId: string | null;
  adgroupId: string | null;
  formId: string | null;
  campaignId: string | null;
  createdTime: string | null;
  fieldData: LeadFieldData[];
};

type LeadFetchResp = {
  id?: string;
  created_time?: string;
  ad_id?: string;
  adgroup_id?: string;
  form_id?: string;
  campaign_id?: string;
  field_data?: LeadFieldData[];
  error?: GraphError;
};

/**
 * Pull the full lead data for a leadgen_id (received via webhook).
 * Requires the Page access token + the `leads_retrieval` scope
 * granted at OAuth time.
 *
 * Returns the field_data array — caller maps Meta's field names
 * onto the CRM contact shape. Meta's standard fields are:
 *   - full_name (or first_name + last_name)
 *   - email
 *   - phone_number
 *   - street_address / city / state / zip_code / country
 * Custom questions show up as arbitrary keys.
 */
export async function fetchLeadByLeadgenId(params: {
  leadgenId: string;
  pageAccessToken: string;
}): Promise<RetrievedLead> {
  const url = `${META_GRAPH_BASE}/${params.leadgenId}?fields=id,created_time,ad_id,adgroup_id,form_id,campaign_id,field_data&access_token=${encodeURIComponent(
    params.pageAccessToken,
  )}`;
  const res = await fetch(url);
  const body = (await res.json().catch(() => ({}))) as LeadFetchResp;
  if (!res.ok || !body.id) {
    const msg = body.error?.message || `HTTP ${res.status}`;
    throw tagError(
      new Error(`Meta lead retrieval failed: ${msg}`),
      body.error,
    );
  }
  return {
    leadgenId: body.id,
    adId: body.ad_id ?? null,
    adgroupId: body.adgroup_id ?? null,
    formId: body.form_id ?? null,
    campaignId: body.campaign_id ?? null,
    createdTime: body.created_time ?? null,
    fieldData: body.field_data ?? [],
  };
}

/**
 * Map Meta's `field_data` shape onto the CRM contact fields we
 * actually use. Returns the keys runContactIngestion expects.
 *
 * Falls back gracefully:
 *   - `full_name` preferred, but first_name + last_name composed
 *     when only those are present
 *   - email + phone normalization handled downstream by
 *     runContactIngestion (this just hands the strings over)
 */
export function mapLeadFieldsToContactInput(fields: LeadFieldData[]): {
  name: string | null;
  email: string | null;
  phone: string | null;
  property_address: string | null;
  notes: string | null;
} {
  const byKey = new Map<string, string>();
  for (const f of fields) {
    const v = f.values?.[0]?.trim();
    if (v) byKey.set(f.name.toLowerCase(), v);
  }

  const fullName = byKey.get("full_name");
  const firstName = byKey.get("first_name");
  const lastName = byKey.get("last_name");
  const name =
    fullName ??
    [firstName, lastName].filter(Boolean).join(" ").trim() ??
    null;

  const street = byKey.get("street_address");
  const city = byKey.get("city");
  const state = byKey.get("state");
  const zip = byKey.get("zip_code") ?? byKey.get("post_code");
  const addressParts = [street, [city, state, zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ")
    .trim();

  // Stuff any non-standard fields into notes so the agent can see
  // what the lead actually answered.
  const standardKeys = new Set([
    "full_name",
    "first_name",
    "last_name",
    "email",
    "phone_number",
    "street_address",
    "city",
    "state",
    "zip_code",
    "post_code",
    "country",
  ]);
  const extras: string[] = [];
  for (const [k, v] of byKey.entries()) {
    if (!standardKeys.has(k)) {
      extras.push(`${prettify(k)}: ${v}`);
    }
  }

  return {
    name: name || null,
    email: byKey.get("email") || null,
    phone: byKey.get("phone_number") || null,
    property_address: addressParts || null,
    notes: extras.length > 0 ? extras.join(" | ") : null,
  };
}

function prettify(snake: string): string {
  return snake.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ══════════════════════════════════════════════════════════════════════
// Campaign creation — Phase 2B.2
// ══════════════════════════════════════════════════════════════════════
//
// Six Meta API calls per launch:
//   1. POST /act_<id>/campaigns         — campaign with objective
//   2. POST /act_<id>/adsets            — ad set: targeting + budget
//   3. POST /act_<id>/adimages          — upload creative image
//   4. POST /<page-id>/leadgen_forms    — lead form questions + privacy
//   5. POST /act_<id>/adcreatives       — creative with image_hash + form
//   6. POST /act_<id>/ads               — the ad linking creative + adset
//
// Each helper does ONE call and rethrows tagged errors. The orchestrator
// (`createLeadAdCampaign`) calls them in order and the caller (the
// /create route) saves a `lead_ad_campaigns` row up-front so a mid-
// orchestration failure still has an audit trail.
//
// Real-estate-specific notes:
//   - special_ad_categories MUST include 'HOUSING' on the campaign.
//     Meta restricts the targeting that's allowed in HOUSING ads —
//     no detailed demographic/interest targeting, broad geo/age only.
//   - destination_type 'ON_AD' keeps the lead form inline so the
//     visitor never leaves Facebook.

// ── Helpers ──────────────────────────────────────────────────────────

type CreatedId = { id: string };

async function postGraph<T = CreatedId>(
  url: string,
  body: URLSearchParams,
): Promise<T> {
  const res = await fetch(url, { method: "POST", body });
  const json = (await res.json().catch(() => ({}))) as T & { error?: GraphError };
  if (!res.ok || (json as { id?: string }).id === undefined) {
    const msg = json.error?.message || `HTTP ${res.status}`;
    throw tagError(new Error(msg), json.error);
  }
  return json;
}

// ── 1. Campaign ──────────────────────────────────────────────────────

export type CampaignParams = {
  adAccountId: string; // 'act_<digits>'
  userAccessToken: string;
  name: string;
  /** Phase 2B.2 only ships LEAD_GENERATION. Reserved name kept for forward-compat. */
  objective?: "LEAD_GENERATION" | "OUTCOME_LEADS";
  /** 'PAUSED' (default) lets us tweak before going live; 'ACTIVE' launches immediately. */
  status?: "PAUSED" | "ACTIVE";
  /**
   * Required for real-estate ads by Meta policy. Always set to ['HOUSING'].
   * Passing this also automatically narrows what targeting Meta accepts
   * (no age/gender, broad geo only, etc).
   */
  specialAdCategories?: string[];
};

export async function createCampaign(
  p: CampaignParams,
): Promise<{ campaignId: string }> {
  const body = new URLSearchParams();
  body.set("name", p.name);
  body.set("objective", p.objective ?? "OUTCOME_LEADS");
  body.set("status", p.status ?? "PAUSED");
  body.set("buying_type", "AUCTION");
  body.set(
    "special_ad_categories",
    JSON.stringify(p.specialAdCategories ?? ["HOUSING"]),
  );
  body.set("access_token", p.userAccessToken);

  const out = await postGraph(`${META_GRAPH_BASE}/${p.adAccountId}/campaigns`, body);
  return { campaignId: out.id };
}

// ── 2. Ad Set ────────────────────────────────────────────────────────

export type AdSetTargeting = {
  /** ISO country codes. Defaults to ['US']. */
  countries?: string[];
  /** Up to 50 zip codes. Each gets the same radius. */
  zipCodes?: string[];
  /** Radius in miles around each zip. Default 10. */
  radiusMiles?: number;
  /** Defaults to 25. HOUSING ads have a minimum of 18 enforced by Meta. */
  ageMin?: number;
  ageMax?: number;
};

export type AdSetParams = {
  adAccountId: string;
  userAccessToken: string;
  campaignId: string;
  pageId: string;
  name: string;
  /** Daily budget in cents (Meta wants cents as integer). */
  dailyBudgetCents: number;
  /** ISO start time. Default: now. */
  startTime?: string;
  /** ISO end time. Optional but recommended so campaigns don't run forever. */
  endTime?: string;
  targeting: AdSetTargeting;
  status?: "PAUSED" | "ACTIVE";
};

export async function createAdSet(
  p: AdSetParams,
): Promise<{ adSetId: string }> {
  const t = p.targeting;
  const targeting: Record<string, unknown> = {
    geo_locations: {
      countries: t.countries ?? ["US"],
      ...(t.zipCodes && t.zipCodes.length > 0
        ? {
            zips: t.zipCodes.map((z) => ({
              key: `US:${z}`,
              radius: t.radiusMiles ?? 10,
              distance_unit: "mile",
            })),
          }
        : {}),
    },
    age_min: t.ageMin ?? 25,
    age_max: t.ageMax ?? 65,
  };

  const body = new URLSearchParams();
  body.set("name", p.name);
  body.set("campaign_id", p.campaignId);
  body.set("daily_budget", String(p.dailyBudgetCents));
  body.set("billing_event", "IMPRESSIONS");
  body.set("optimization_goal", "LEAD_GENERATION");
  body.set("destination_type", "ON_AD");
  body.set("status", p.status ?? "PAUSED");
  body.set("start_time", p.startTime ?? new Date().toISOString());
  if (p.endTime) body.set("end_time", p.endTime);
  body.set("targeting", JSON.stringify(targeting));
  body.set("promoted_object", JSON.stringify({ page_id: p.pageId }));
  body.set("access_token", p.userAccessToken);

  const out = await postGraph(
    `${META_GRAPH_BASE}/${p.adAccountId}/adsets`,
    body,
  );
  return { adSetId: out.id };
}

// ── 3. Ad Image upload ───────────────────────────────────────────────

/**
 * Upload an image to the ad account's image library. Returns the
 * `image_hash` Meta assigns; the creative references this hash.
 *
 * Two ways to upload:
 *   - multipart binary (what we use)
 *   - `url` param pointing at a publicly fetchable URL
 *
 * Multipart is more reliable for our signed-URL-from-storage case
 * since Meta sometimes fails to fetch the `url` variant when the
 * signed URL has unusual query params.
 */
export async function uploadAdImage(params: {
  adAccountId: string;
  userAccessToken: string;
  imageBytes: Uint8Array;
  fileName: string;
  contentType: string;
}): Promise<{ imageHash: string; imageUrl: string }> {
  const form = new FormData();
  form.set(
    params.fileName,
    new Blob([params.imageBytes as BlobPart], { type: params.contentType }),
    params.fileName,
  );
  form.set("access_token", params.userAccessToken);

  const res = await fetch(
    `${META_GRAPH_BASE}/${params.adAccountId}/adimages`,
    { method: "POST", body: form },
  );
  type UploadResp = {
    images?: Record<string, { hash?: string; url?: string }>;
    error?: GraphError;
  };
  const json = (await res.json().catch(() => ({}))) as UploadResp;
  if (!res.ok) {
    throw tagError(
      new Error(json.error?.message || `HTTP ${res.status}`),
      json.error,
    );
  }
  const first = json.images && Object.values(json.images)[0];
  if (!first?.hash || !first?.url) {
    throw new Error("Meta /adimages returned no image_hash");
  }
  return { imageHash: first.hash, imageUrl: first.url };
}

// ── 4. Lead Form ─────────────────────────────────────────────────────

export type LeadFormQuestionType =
  | "FULL_NAME"
  | "FIRST_NAME"
  | "LAST_NAME"
  | "EMAIL"
  | "PHONE"
  | "STREET_ADDRESS"
  | "CITY"
  | "STATE"
  | "ZIP_CODE";

export type LeadFormParams = {
  pageId: string;
  pageAccessToken: string;
  name: string;
  /** Standard form fields to ask for. Order matches what Meta shows. */
  questions: LeadFormQuestionType[];
  privacyPolicyUrl: string;
  /** Optional URL the user is sent to after submitting. */
  followUpActionUrl?: string;
  locale?: string;
};

export async function createLeadForm(
  p: LeadFormParams,
): Promise<{ formId: string }> {
  const body = new URLSearchParams();
  body.set("name", p.name);
  body.set(
    "questions",
    JSON.stringify(p.questions.map((q) => ({ type: q }))),
  );
  body.set(
    "privacy_policy",
    JSON.stringify({ url: p.privacyPolicyUrl }),
  );
  if (p.followUpActionUrl) {
    body.set("follow_up_action_url", p.followUpActionUrl);
  }
  body.set("locale", p.locale ?? "EN_US");
  body.set("access_token", p.pageAccessToken);

  const out = await postGraph(
    `${META_GRAPH_BASE}/${p.pageId}/leadgen_forms`,
    body,
  );
  return { formId: out.id };
}

// ── 5. Ad Creative ───────────────────────────────────────────────────

export type AdCreativeParams = {
  adAccountId: string;
  userAccessToken: string;
  name: string;
  pageId: string;
  /** Instagram Business User ID — required for IG placement. Optional. */
  instagramActorId?: string;
  body: string;
  /** Headline (40-char max recommended for desktop). */
  headline?: string;
  imageHash: string;
  leadFormId: string;
  /** Landing URL — required by Meta even though the lead form is on-ad. We use the agent's site. */
  link: string;
};

export async function createAdCreative(
  p: AdCreativeParams,
): Promise<{ creativeId: string }> {
  const linkData: Record<string, unknown> = {
    message: p.body,
    link: p.link,
    image_hash: p.imageHash,
    call_to_action: {
      type: "SIGN_UP",
      value: { lead_gen_form_id: p.leadFormId },
    },
  };
  if (p.headline) linkData.name = p.headline;

  const objectStorySpec: Record<string, unknown> = {
    page_id: p.pageId,
    link_data: linkData,
  };
  if (p.instagramActorId) {
    objectStorySpec.instagram_actor_id = p.instagramActorId;
  }

  const body = new URLSearchParams();
  body.set("name", p.name);
  body.set("object_story_spec", JSON.stringify(objectStorySpec));
  body.set("access_token", p.userAccessToken);

  const out = await postGraph(
    `${META_GRAPH_BASE}/${p.adAccountId}/adcreatives`,
    body,
  );
  return { creativeId: out.id };
}

// ── 6. Ad ────────────────────────────────────────────────────────────

export type AdParams = {
  adAccountId: string;
  userAccessToken: string;
  name: string;
  adSetId: string;
  creativeId: string;
  status?: "PAUSED" | "ACTIVE";
};

export async function createAd(p: AdParams): Promise<{ adId: string }> {
  const body = new URLSearchParams();
  body.set("name", p.name);
  body.set("adset_id", p.adSetId);
  body.set("creative", JSON.stringify({ creative_id: p.creativeId }));
  body.set("status", p.status ?? "PAUSED");
  body.set("access_token", p.userAccessToken);

  const out = await postGraph(`${META_GRAPH_BASE}/${p.adAccountId}/ads`, body);
  return { adId: out.id };
}

// ── Orchestrator ─────────────────────────────────────────────────────

export type CreateLeadAdInput = {
  adAccountId: string;
  userAccessToken: string;
  pageId: string;
  pageAccessToken: string;
  instagramActorId?: string;
  campaignName: string;
  body: string;
  headline?: string;
  imageBytes: Uint8Array;
  imageFileName: string;
  imageContentType: string;
  formQuestions: LeadFormQuestionType[];
  privacyPolicyUrl: string;
  landingUrl: string;
  targeting: AdSetTargeting;
  dailyBudgetCents: number;
  startTime?: string;
  endTime?: string;
  /** PAUSED first by default so the agent can review in Ads Manager
   *  before flipping to ACTIVE. The wizard exposes a "launch immediately"
   *  toggle that sets this to 'ACTIVE'. */
  launchStatus?: "PAUSED" | "ACTIVE";
};

export type CreateLeadAdResult = {
  campaignId: string;
  adSetId: string;
  adImageHash: string;
  adImageUrl: string;
  formId: string;
  creativeId: string;
  adId: string;
};

/**
 * Orchestrate the 6 Meta calls in order. Returns all the new ids
 * so the caller can persist them onto the lead_ad_campaigns row.
 *
 * Idempotency note: this function is NOT idempotent on retry — a
 * partial failure leaves orphan campaign/adset/etc rows in Meta.
 * The caller (the API route) writes the lead_ad_campaigns row with
 * status='creating' BEFORE calling, then flips to 'active' on
 * success or 'failed' on error with the partial-create ids saved
 * where applicable. Manual cleanup in Ads Manager is the fallback
 * for orphans — automatic rollback is a Phase 2B.3 deliverable.
 */
export async function createLeadAdCampaign(
  input: CreateLeadAdInput,
): Promise<CreateLeadAdResult> {
  const launchStatus = input.launchStatus ?? "PAUSED";

  const { campaignId } = await createCampaign({
    adAccountId: input.adAccountId,
    userAccessToken: input.userAccessToken,
    name: input.campaignName,
    status: launchStatus,
  });

  const { adSetId } = await createAdSet({
    adAccountId: input.adAccountId,
    userAccessToken: input.userAccessToken,
    campaignId,
    pageId: input.pageId,
    name: `${input.campaignName} — ad set`,
    dailyBudgetCents: input.dailyBudgetCents,
    startTime: input.startTime,
    endTime: input.endTime,
    targeting: input.targeting,
    status: launchStatus,
  });

  const { imageHash, imageUrl } = await uploadAdImage({
    adAccountId: input.adAccountId,
    userAccessToken: input.userAccessToken,
    imageBytes: input.imageBytes,
    fileName: input.imageFileName,
    contentType: input.imageContentType,
  });

  const { formId } = await createLeadForm({
    pageId: input.pageId,
    pageAccessToken: input.pageAccessToken,
    name: `${input.campaignName} — lead form`,
    questions: input.formQuestions,
    privacyPolicyUrl: input.privacyPolicyUrl,
  });

  const { creativeId } = await createAdCreative({
    adAccountId: input.adAccountId,
    userAccessToken: input.userAccessToken,
    name: `${input.campaignName} — creative`,
    pageId: input.pageId,
    instagramActorId: input.instagramActorId,
    body: input.body,
    headline: input.headline,
    imageHash,
    leadFormId: formId,
    link: input.landingUrl,
  });

  const { adId } = await createAd({
    adAccountId: input.adAccountId,
    userAccessToken: input.userAccessToken,
    name: `${input.campaignName} — ad`,
    adSetId,
    creativeId,
    status: launchStatus,
  });

  return {
    campaignId,
    adSetId,
    adImageHash: imageHash,
    adImageUrl: imageUrl,
    formId,
    creativeId,
    adId,
  };
}
