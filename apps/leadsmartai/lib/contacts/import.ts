import Papa from "papaparse";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { splitName } from "@/lib/contacts/formatters";
import type { LifecycleStage, RelationshipType } from "@/lib/contacts/types";

/**
 * Parsed CSV row. Covers both sphere-shape (past-client CSVs with closing
 * fields) and lead-shape (pipeline CSVs with rating/source/search
 * criteria). lifecycleStage is inferred per-row: if closingDate is set →
 * past_client; if relationshipType says referrer/sphere → match; else
 * → lead.
 */
export type ParsedContactRow = {
  /** 1-based row number as it appeared in the CSV (for error mapping). */
  rowNumber: number;
  lifecycleStage: LifecycleStage;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  propertyAddress: string | null;
  closingAddress: string | null;
  closingDate: string | null;
  closingPrice: number | null;
  relationshipType: RelationshipType;
  relationshipTag: string | null;
  preferredLanguage: "en" | "zh";
  // Lead-shape optional fields
  source: string | null;
  rating: string | null;
  searchLocation: string | null;
  priceMin: number | null;
  priceMax: number | null;
  beds: number | null;
  baths: number | null;
  leadType: string | null;
  intent: string | null;
  city: string | null;
  state: string | null;
  /** Never trust the CSV — the spec §2.8 anniversary_opt_in must be confirmed
   * per-row in the UI. This mirrors what the CSV said but the API will NOT
   * write it as true unless the commit payload also confirms it. */
  csvAnniversaryOptIn: boolean;
  errors: string[];
};

/** Legacy alias — kept until the UI client switches to the new name. */
export type ParsedSphereRow = ParsedContactRow;

export type ParseResult = {
  rows: ParsedContactRow[];
  headers: string[];
  skipped: number;
  /** Detected CSV shape. "mixed" when some rows look like past-clients and others leads. */
  detectedShape: "sphere" | "lead" | "mixed" | "empty";
};

const HEADER_ALIASES: Record<string, string[]> = {
  firstName: ["first name", "firstname", "given name", "first"],
  lastName: ["last name", "lastname", "surname", "family name", "last"],
  // Single-field name — split to firstName/lastName if no first/last headers.
  fullName: ["name", "full name", "contact name", "client name"],
  email: ["email", "e-mail", "email address"],
  phone: ["phone", "mobile", "cell", "telephone", "phone number"],
  address: ["address", "street address", "current address", "mailing address", "home address"],
  // Lead-shape: the inquiry property. Sphere-shape reuses "property address"
  // for the closed-on address. Closing date presence distinguishes intent.
  propertyAddress: ["property address", "subject property", "listing address", "interested in"],
  closingAddress: ["closing address", "closed on", "transaction address", "purchased address"],
  closingDate: ["closing date", "close date", "closed date", "settle date", "close of escrow"],
  closingPrice: ["closing price", "purchase price", "sale price", "price"],
  relationshipType: ["relationship", "relationship type", "type", "role"],
  relationshipTag: ["tag", "note", "notes", "context"],
  preferredLanguage: ["language", "preferred language", "lang"],
  anniversaryOptIn: [
    "anniversary opt-in",
    "anniversary opt in",
    "opt-in",
    "opt in",
    "sms opt in",
    "consent",
  ],
  // Lead-shape columns
  source: ["source", "lead source", "origin"],
  rating: ["rating", "grade", "temperature", "priority"],
  searchLocation: ["search area", "looking in", "target area", "target location"],
  priceMin: ["min price", "price min", "budget min"],
  priceMax: ["max price", "price max", "budget max"],
  beds: ["beds", "bedrooms", "# beds"],
  baths: ["baths", "bathrooms", "# baths"],
  leadType: ["lead type", "buyer/seller", "side"],
  intent: ["intent", "buying or selling"],
  city: ["city"],
  state: ["state"],
};

function buildHeaderIndex(headers: string[]): Record<string, string | null> {
  const lower = headers.map((h) => h.trim().toLowerCase());
  const index: Record<string, string | null> = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const found = lower.find((h) => aliases.includes(h));
    index[key] = found ?? null;
  }
  return index;
}

function pickField(
  row: Record<string, unknown>,
  headers: string[],
  aliasHeader: string | null,
): string | null {
  if (!aliasHeader) return null;
  // Find the original-cased header that matches case-insensitively.
  const actual = headers.find((h) => h.trim().toLowerCase() === aliasHeader);
  if (!actual) return null;
  const v = row[actual];
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function parseRelationshipType(raw: string | null): RelationshipType {
  const v = (raw ?? "").toLowerCase();
  if (v.includes("buyer") && v.includes("seller")) return "past_both";
  if (v.includes("buyer")) return "past_buyer";
  if (v.includes("seller")) return "past_seller";
  if (v.includes("referr")) return "referral_source";
  if (v.includes("sphere") || v === "" || v === "contact") return "sphere";
  if (v.includes("prospect")) return "prospect";
  return "sphere";
}

function parseLanguage(raw: string | null): "en" | "zh" {
  const v = (raw ?? "").toLowerCase();
  if (v.startsWith("zh") || v.includes("chinese") || v.includes("中")) return "zh";
  return "en";
}

function parseBool(raw: string | null): boolean {
  const v = (raw ?? "").toLowerCase().trim();
  return v === "true" || v === "yes" || v === "y" || v === "1";
}

function parsePrice(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Accept YYYY-MM-DD or M/D/YYYY. Returns ISO date string or null. */
function parseDate(raw: string | null): string | null {
  if (!raw) return null;
  // ISO-ish
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function validateEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function normalizePhone(v: string): string | null {
  // Keep + and digits, drop everything else. Require at least 10 digits.
  const digits = v.replace(/[^\d+]/g, "");
  const justDigits = digits.replace(/\D/g, "");
  if (justDigits.length < 10) return null;
  return digits;
}

function parseNumber(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Infer the row's lifecycle stage from what the CSV gave us. Priority:
 *   1. Explicit `relationship_type` column (past_* / sphere / referrer)
 *   2. `closing_date` present → past_client
 *   3. Lead-shape signals (rating / source / search criteria) → lead
 *   4. Fallback → sphere (safe default — can be manually reclassified)
 */
function inferLifecycleStage(args: {
  relationshipType: RelationshipType | null;
  hasClosingDate: boolean;
  hasLeadSignals: boolean;
}): LifecycleStage {
  const { relationshipType, hasClosingDate, hasLeadSignals } = args;
  if (relationshipType === "past_buyer" || relationshipType === "past_seller" || relationshipType === "past_both") {
    return "past_client";
  }
  if (relationshipType === "referral_source") return "referral_source";
  if (hasClosingDate) return "past_client";
  if (hasLeadSignals) return "lead";
  if (relationshipType === "prospect") return "lead";
  if (relationshipType === "sphere") return "sphere";
  return "sphere";
}

/**
 * Parse a CSV that can be either sphere-shape (past clients with closing
 * data) or lead-shape (pipeline prospects with rating/source/search
 * criteria). Infers lifecycle_stage per row.
 */
export function parseSphereCsv(csv: string): ParseResult {
  const parsed = Papa.parse<Record<string, unknown>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h,
  });
  const headers = parsed.meta.fields ?? [];
  const idx = buildHeaderIndex(headers);

  const rows: ParsedContactRow[] = [];
  let skipped = 0;

  (parsed.data as Record<string, unknown>[]).forEach((raw, i) => {
    const errors: string[] = [];

    // Name: prefer split first/last; fall back to a single-field name that
    // we split on first whitespace.
    let first = pickField(raw, headers, idx.firstName);
    let last = pickField(raw, headers, idx.lastName);
    if (!first && !last) {
      const combined = pickField(raw, headers, idx.fullName);
      if (combined) {
        const split = splitName(combined);
        first = split.firstName;
        last = split.lastName;
      }
    }
    if (!first) {
      skipped++;
      return; // can't keep a row with no name — drop silently
    }

    const email = pickField(raw, headers, idx.email);
    if (email && !validateEmail(email)) errors.push(`Invalid email: ${email}`);

    const phoneRaw = pickField(raw, headers, idx.phone);
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
    if (phoneRaw && !phone) errors.push(`Invalid phone: ${phoneRaw}`);

    const closingDate = parseDate(pickField(raw, headers, idx.closingDate));
    const closingPrice = parsePrice(pickField(raw, headers, idx.closingPrice));
    const relationshipRaw = pickField(raw, headers, idx.relationshipType);
    const relationshipType = parseRelationshipType(relationshipRaw);
    const csvOptIn = parseBool(pickField(raw, headers, idx.anniversaryOptIn));

    const source = pickField(raw, headers, idx.source);
    const rating = pickField(raw, headers, idx.rating);
    const searchLocation = pickField(raw, headers, idx.searchLocation);
    const priceMin = parseNumber(pickField(raw, headers, idx.priceMin));
    const priceMax = parseNumber(pickField(raw, headers, idx.priceMax));
    const beds = parseNumber(pickField(raw, headers, idx.beds));
    const baths = parseNumber(pickField(raw, headers, idx.baths));
    const leadType = pickField(raw, headers, idx.leadType);
    const intent = pickField(raw, headers, idx.intent);
    const city = pickField(raw, headers, idx.city);
    const state = pickField(raw, headers, idx.state);

    const lifecycleStage = inferLifecycleStage({
      relationshipType: relationshipRaw ? relationshipType : null,
      hasClosingDate: !!closingDate,
      hasLeadSignals: !!(source || rating || searchLocation || priceMin || priceMax || leadType),
    });

    // Anniversary trigger requires a closing. Flag if opt-in is claimed but
    // closing data is missing.
    if (csvOptIn && !closingDate) {
      errors.push("anniversary_opt_in requires a closing_date");
    }

    rows.push({
      rowNumber: i + 2, // header is row 1
      lifecycleStage,
      firstName: first,
      lastName: last,
      email,
      phone,
      address: pickField(raw, headers, idx.address),
      propertyAddress: pickField(raw, headers, idx.propertyAddress),
      closingAddress: pickField(raw, headers, idx.closingAddress),
      closingDate,
      closingPrice,
      relationshipType,
      relationshipTag: pickField(raw, headers, idx.relationshipTag),
      preferredLanguage: parseLanguage(pickField(raw, headers, idx.preferredLanguage)),
      source,
      rating,
      searchLocation,
      priceMin,
      priceMax,
      beds,
      baths,
      leadType,
      intent,
      city,
      state,
      csvAnniversaryOptIn: csvOptIn,
      errors,
    });
  });

  const detectedShape: ParseResult["detectedShape"] =
    rows.length === 0
      ? "empty"
      : rows.every((r) => r.lifecycleStage === "lead")
        ? "lead"
        : rows.every((r) =>
              r.lifecycleStage === "past_client" ||
              r.lifecycleStage === "sphere" ||
              r.lifecycleStage === "referral_source",
            )
          ? "sphere"
          : "mixed";

  return { rows, headers, skipped, detectedShape };
}

export type CommitRow = {
  lifecycleStage?: LifecycleStage;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  propertyAddress?: string | null;
  closingAddress: string | null;
  closingDate: string | null;
  closingPrice: number | null;
  relationshipType: RelationshipType;
  relationshipTag: string | null;
  preferredLanguage: "en" | "zh";
  // Lead-shape fields (optional)
  source?: string | null;
  rating?: string | null;
  searchLocation?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  beds?: number | null;
  baths?: number | null;
  leadType?: string | null;
  intent?: string | null;
  city?: string | null;
  state?: string | null;
  /** Must be confirmed by the user per-row in the UI (spec §2.8). */
  anniversaryOptIn: boolean;
};

/**
 * Fallback lifecycle-stage derivation when the caller didn't set one.
 * `past_buyer`/`past_seller`/`past_both` → `past_client`; `referral_source`
 * → itself; `sphere`/`prospect` → `sphere`.
 */
function lifecycleStageFromRelationship(
  rel: RelationshipType,
): "past_client" | "referral_source" | "sphere" {
  switch (rel) {
    case "past_buyer":
    case "past_seller":
    case "past_both":
      return "past_client";
    case "referral_source":
      return "referral_source";
    case "sphere":
    case "prospect":
      return "sphere";
  }
}

export async function commitSphereRows(
  agentId: string,
  rows: CommitRow[],
): Promise<{ inserted: number; errors: string[] }> {
  if (!rows.length) return { inserted: 0, errors: [] };

  // Validate opt-in rule: opt-in requires closing_date.
  const errors: string[] = [];
  const safe = rows.filter((r, i) => {
    if (r.anniversaryOptIn && !r.closingDate) {
      errors.push(`Row ${i + 1}: anniversary_opt_in requires a closing date — dropped`);
      return false;
    }
    return true;
  });

  if (!safe.length) return { inserted: 0, errors };

  const insertPayload = safe.map((r) => ({
    agent_id: agentId,
    lifecycle_stage: r.lifecycleStage ?? lifecycleStageFromRelationship(r.relationshipType),
    first_name: r.firstName,
    last_name: r.lastName,
    email: r.email,
    phone: r.phone,
    address: r.address,
    property_address: r.propertyAddress ?? null,
    closing_address: r.closingAddress,
    closing_date: r.closingDate,
    closing_price: r.closingPrice,
    relationship_type: r.relationshipType,
    relationship_tag: r.relationshipTag,
    preferred_language: r.preferredLanguage,
    anniversary_opt_in: r.anniversaryOptIn,
    source: r.source ?? null,
    rating: r.rating ?? null,
    search_location: r.searchLocation ?? null,
    price_min: r.priceMin ?? null,
    price_max: r.priceMax ?? null,
    beds: r.beds ?? null,
    baths: r.baths ?? null,
    lead_type: r.leadType ?? null,
    intent: r.intent ?? null,
    city: r.city ?? null,
    state: r.state ?? null,
  }));

  // Use upsert on (agent_id, lower(email)) so re-imports merge rather than
  // duplicating. The DB-level unique index enforces dedup; onConflict here
  // must match the index's expression.
  const { data, error } = await supabaseAdmin
    .from("contacts")
    .insert(insertPayload as never)
    .select("id");
  if (error) {
    errors.push(`Insert failed: ${error.message}`);
    return { inserted: 0, errors };
  }

  return { inserted: data?.length ?? 0, errors };
}

// Preferred names post-consolidation. `commitSphereRows` and `parseSphereCsv`
// stay as aliases until the UI client (SphereImportClient) switches.
export const commitContactRows = commitSphereRows;
export const parseContactCsv = parseSphereCsv;
