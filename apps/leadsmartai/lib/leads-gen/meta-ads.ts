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
