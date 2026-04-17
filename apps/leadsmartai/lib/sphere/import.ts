import Papa from "papaparse";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { SphereRelationshipType } from "./types";

export type ParsedSphereRow = {
  /** 1-based row number as it appeared in the CSV (for error mapping). */
  rowNumber: number;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  closingAddress: string | null;
  closingDate: string | null;
  closingPrice: number | null;
  relationshipType: SphereRelationshipType;
  relationshipTag: string | null;
  preferredLanguage: "en" | "zh";
  /** Never trust the CSV — the spec §2.8 anniversary_opt_in must be confirmed
   * per-row in the UI. This mirrors what the CSV said but the API will NOT
   * write it as true unless the commit payload also confirms it. */
  csvAnniversaryOptIn: boolean;
  errors: string[];
};

export type ParseResult = {
  rows: ParsedSphereRow[];
  headers: string[];
  skipped: number;
};

const HEADER_ALIASES: Record<string, string[]> = {
  firstName: ["first name", "firstname", "given name", "first"],
  lastName: ["last name", "lastname", "surname", "family name", "last"],
  email: ["email", "e-mail", "email address"],
  phone: ["phone", "mobile", "cell", "telephone", "phone number"],
  address: ["address", "street address", "current address", "mailing address"],
  closingAddress: ["closing address", "property address", "closed on", "transaction address"],
  closingDate: ["closing date", "close date", "closed date", "settle date"],
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

function parseRelationshipType(raw: string | null): SphereRelationshipType {
  const v = (raw ?? "").toLowerCase();
  if (v.includes("buyer")) return "past_buyer_client";
  if (v.includes("seller")) return "past_seller_client";
  if (v.includes("referr")) return "referral_source";
  if (v.includes("sphere") || v === "" || v === "contact") return "sphere_non_client";
  return "sphere_non_client";
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

export function parseSphereCsv(csv: string): ParseResult {
  const parsed = Papa.parse<Record<string, unknown>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h,
  });
  const headers = parsed.meta.fields ?? [];
  const idx = buildHeaderIndex(headers);

  const rows: ParsedSphereRow[] = [];
  let skipped = 0;

  (parsed.data as Record<string, unknown>[]).forEach((raw, i) => {
    const errors: string[] = [];
    const first = pickField(raw, headers, idx.firstName);
    const last = pickField(raw, headers, idx.lastName);
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
    const relationshipType = parseRelationshipType(
      pickField(raw, headers, idx.relationshipType),
    );
    const csvOptIn = parseBool(pickField(raw, headers, idx.anniversaryOptIn));

    // Anniversary trigger requires a closing. Flag if opt-in is claimed but
    // closing data is missing.
    if (csvOptIn && !closingDate) {
      errors.push("anniversary_opt_in requires a closing_date");
    }

    rows.push({
      rowNumber: i + 2, // header is row 1
      firstName: first,
      lastName: last,
      email,
      phone,
      address: pickField(raw, headers, idx.address),
      closingAddress: pickField(raw, headers, idx.closingAddress),
      closingDate,
      closingPrice,
      relationshipType,
      relationshipTag: pickField(raw, headers, idx.relationshipTag),
      preferredLanguage: parseLanguage(pickField(raw, headers, idx.preferredLanguage)),
      csvAnniversaryOptIn: csvOptIn,
      errors,
    });
  });

  return { rows, headers, skipped };
}

export type CommitRow = {
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  closingAddress: string | null;
  closingDate: string | null;
  closingPrice: number | null;
  relationshipType: SphereRelationshipType;
  relationshipTag: string | null;
  preferredLanguage: "en" | "zh";
  /** Must be confirmed by the user per-row in the UI (spec §2.8). */
  anniversaryOptIn: boolean;
};

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
    first_name: r.firstName,
    last_name: r.lastName,
    email: r.email,
    phone: r.phone,
    address: r.address,
    closing_address: r.closingAddress,
    closing_date: r.closingDate,
    closing_price: r.closingPrice,
    relationship_type: r.relationshipType,
    relationship_tag: r.relationshipTag,
    preferred_language: r.preferredLanguage,
    anniversary_opt_in: r.anniversaryOptIn,
  }));

  const { data, error } = await supabaseAdmin
    .from("sphere_contacts")
    .insert(insertPayload as never)
    .select("id");
  if (error) {
    errors.push(`Insert failed: ${error.message}`);
    return { inserted: 0, errors };
  }

  return { inserted: data?.length ?? 0, errors };
}
