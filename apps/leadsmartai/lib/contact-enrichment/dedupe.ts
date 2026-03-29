import { displayAddress, displayPhone, normalizeAddress, normalizeEmail, normalizePhone } from "./normalize";
import type { DuplicateMatchCandidate, DuplicateMatchReason, LeadLike } from "./types";

function safeName(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

export function getDuplicateReasons(a: LeadLike, b: LeadLike): DuplicateMatchReason[] {
  return buildReasonsInner(a, b);
}

/** Sum of rule weights for incoming vs existing CRM row (threshold 50+ = likely duplicate). */
export function incomingDuplicateScore(a: LeadLike, b: LeadLike): number {
  return getDuplicateReasons(a, b).reduce((sum, r) => sum + r.weight, 0);
}

function buildReasonsInner(a: LeadLike, b: LeadLike) {
  const reasons: DuplicateMatchReason[] = [];
  const emailA = normalizeEmail(typeof a.email === "string" ? a.email : null);
  const emailB = normalizeEmail(typeof b.email === "string" ? b.email : null);
  const phoneA = normalizePhone(displayPhone(a));
  const phoneB = normalizePhone(displayPhone(b));
  const addressA = normalizeAddress(displayAddress(a));
  const addressB = normalizeAddress(displayAddress(b));
  const nameA = safeName(typeof a.name === "string" ? a.name : null);
  const nameB = safeName(typeof b.name === "string" ? b.name : null);

  if (emailA && emailB && emailA === emailB) {
    reasons.push({ type: "email_exact", weight: 55, detail: "Same normalized email" });
  }
  if (phoneA && phoneB && phoneA === phoneB) {
    reasons.push({ type: "phone_exact", weight: 45, detail: "Same normalized phone" });
  }
  if (addressA && addressB && addressA === addressB) {
    reasons.push({ type: "address_exact", weight: 30, detail: "Same normalized address" });
  }
  if (nameA && nameB && nameA === nameB) {
    reasons.push({ type: "name_exact", weight: 20, detail: "Same name" });
  }
  if (nameA && nameB && emailA && emailB && nameA === nameB) {
    const h0 = emailA.split("@")[0] ?? "";
    const h1 = emailB.split("@")[0] ?? "";
    if (h0 && h0 === h1) {
      reasons.push({ type: "name_email_near", weight: 15, detail: "Same name and email local part" });
    }
  }

  return reasons;
}

export function scoreDuplicatePair(a: LeadLike, b: LeadLike): DuplicateMatchCandidate | null {
  const idA = String(a.id ?? "");
  const idB = String(b.id ?? "");
  if (!idA || !idB || idA === idB) return null;

  const reasons = buildReasonsInner(a, b);
  const confidenceScore = reasons.reduce((sum, r) => sum + r.weight, 0);

  if (confidenceScore < 50) return null;

  const ca = typeof a.created_at === "string" ? a.created_at : "";
  const cb = typeof b.created_at === "string" ? b.created_at : "";
  const [primary, duplicate] = ca <= cb ? [a, b] : [b, a];

  return {
    primaryLeadId: String(primary.id),
    duplicateLeadId: String(duplicate.id),
    confidenceScore: Math.min(confidenceScore, 100),
    reasons,
  };
}

function addToBucket(map: Map<string, string[]>, key: string | null, id: string) {
  if (!key) return;
  const cur = map.get(key);
  if (cur) {
    if (!cur.includes(id)) cur.push(id);
  } else {
    map.set(key, [id]);
  }
}

/**
 * Bucket by normalized email / phone / address, then score pairs (avoids O(n²) over full table).
 */
export function findDuplicateCandidates(leads: LeadLike[]): DuplicateMatchCandidate[] {
  const byId = new Map<string, LeadLike>();
  for (const row of leads) {
    const id = String(row.id ?? "");
    if (id) byId.set(id, row);
  }

  const emailB = new Map<string, string[]>();
  const phoneB = new Map<string, string[]>();
  const addrB = new Map<string, string[]>();

  for (const row of leads) {
    const id = String(row.id ?? "");
    if (!id) continue;
    if (row.merged_into_lead_id != null) continue;

    const ne = normalizeEmail(typeof row.email === "string" ? row.email : null);
    const np = normalizePhone(displayPhone(row));
    const na = normalizeAddress(displayAddress(row));
    addToBucket(emailB, ne, id);
    addToBucket(phoneB, np, id);
    addToBucket(addrB, na, id);
  }

  const pairKeys = new Set<string>();
  const candidates: DuplicateMatchCandidate[] = [];

  function considerPairs(ids: string[]) {
    const uniq = [...new Set(ids)];
    for (let i = 0; i < uniq.length; i += 1) {
      for (let j = i + 1; j < uniq.length; j += 1) {
        const a = uniq[i]!;
        const b = uniq[j]!;
        const k = a < b ? `${a}:${b}` : `${b}:${a}`;
        if (pairKeys.has(k)) continue;
        pairKeys.add(k);
        const rowA = byId.get(a);
        const rowB = byId.get(b);
        if (!rowA || !rowB) continue;
        const c = scoreDuplicatePair(rowA, rowB);
        if (c) candidates.push(c);
      }
    }
  }

  for (const ids of emailB.values()) {
    if (ids.length >= 2) considerPairs(ids);
  }
  for (const ids of phoneB.values()) {
    if (ids.length >= 2) considerPairs(ids);
  }
  for (const ids of addrB.values()) {
    if (ids.length >= 2) considerPairs(ids);
  }

  candidates.sort((x, y) => y.confidenceScore - x.confidenceScore);
  return candidates;
}
