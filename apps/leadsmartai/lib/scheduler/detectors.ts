import type { SphereContact } from "@/lib/sphere/types";
import type { Template } from "@/lib/templates/types";

/**
 * Detectors decide whether a given (contact, template) pair should fire *now*.
 * They return `null` to skip, or a `ProposedFiring` to propose a draft creation.
 *
 * Period key rule: must be stable across cron invocations for the same logical
 * firing. Re-computing on tick N+1 must produce the same key as tick N, so the
 * unique index on trigger_firings dedups.
 */

export type ProposedFiring = {
  periodKey: string;
  triggerContext: Record<string, unknown>;
};

type Detector = (args: {
  contact: SphereContact;
  template: Template;
  now: Date;
}) => ProposedFiring | null;

// ---------- Anniversary (HA-01, HA-01E) ----------
// Fires in a 60-day window centered on the closing-date anniversary. Period key
// is the anniversary year so each year fires once.
export const anniversaryDetector: Detector = ({ contact, template, now }) => {
  if (!contact.closingDate) return null;
  if (!contact.anniversaryOptIn) return null; // spec §2.8 — must be explicitly opted in
  if (
    contact.relationshipType !== "past_buyer_client" &&
    contact.relationshipType !== "past_seller_client"
  ) {
    return null;
  }

  const closing = new Date(contact.closingDate);
  const anniversaryThisYear = new Date(
    now.getFullYear(),
    closing.getMonth(),
    closing.getDate(),
  );
  const daysDelta = Math.round(
    (anniversaryThisYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  // Fire when the anniversary is within the next 14 days, or was within the
  // last 7 (so agents catching up on Monday still get Sunday anniversaries).
  if (daysDelta > 14 || daysDelta < -7) return null;

  // "Not the same year as closing_date.year" — don't fire on the original
  // closing anniversary itself.
  if (now.getFullYear() <= closing.getFullYear()) return null;

  const yearsSince = now.getFullYear() - closing.getFullYear();
  return {
    periodKey: `anniversary:${now.getFullYear()}`,
    triggerContext: {
      trigger: template.id,
      type: "date_anniversary",
      years: yearsSince,
      anniversary_date: anniversaryThisYear.toISOString().slice(0, 10),
    },
  };
};

// ---------- Equity milestone (EM-01 +25%, EM-02 +50%) ----------
export const equityMilestoneDetector: Detector = ({ contact, template, now: _now }) => {
  if (
    contact.relationshipType !== "past_buyer_client" &&
    contact.relationshipType !== "past_seller_client"
  ) {
    return null;
  }
  if (contact.avmCurrent === null || contact.closingPrice === null || contact.closingPrice <= 0) {
    return null;
  }
  const equityPct = (contact.avmCurrent - contact.closingPrice) / contact.closingPrice;
  const threshold = template.id === "EM-02" ? 0.5 : 0.25;
  if (equityPct < threshold) return null;

  // `once_per_milestone` — fire once when the threshold is crossed. Period key
  // is just the threshold so subsequent passes don't refire.
  return {
    periodKey: `equity:${Math.round(threshold * 100)}`,
    triggerContext: {
      trigger: template.id,
      type: "threshold_crossed",
      field: "equity_pct",
      threshold,
      observed: Number(equityPct.toFixed(4)),
      avm_current: contact.avmCurrent,
      closing_price: contact.closingPrice,
    },
  };
};

// ---------- Quarterly equity update (EQ-01) ----------
// Per spec: fires at the start of each calendar quarter. We fire any time
// during the first 14 days of a new quarter — a daily cron catches it.
export const quarterlyEquityDetector: Detector = ({ contact, template: _t, now }) => {
  if (
    contact.relationshipType !== "past_buyer_client" &&
    contact.relationshipType !== "past_seller_client"
  ) {
    return null;
  }
  if (contact.avmCurrent === null || contact.closingPrice === null) return null;

  const month = now.getMonth(); // 0-indexed
  const quarter = Math.floor(month / 3) + 1; // 1..4
  const firstMonthOfQuarter = (quarter - 1) * 3;
  const firstDayOfQuarter = new Date(now.getFullYear(), firstMonthOfQuarter, 1);
  const daysIntoQuarter = Math.floor(
    (now.getTime() - firstDayOfQuarter.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysIntoQuarter > 14) return null;

  return {
    periodKey: `quarter:${now.getFullYear()}Q${quarter}`,
    triggerContext: {
      trigger: "EQ-01",
      type: "calendar_quarter_start",
      quarter: `${now.getFullYear()} Q${quarter}`,
    },
  };
};

// ---------- Dormancy (DR-01) ----------
// 120-day dormancy threshold from spec prototype. Period key is "dormancy:YYYY-MM"
// so if a contact reactivates and goes dormant again next year, we can re-fire.
export const dormancyDetector: Detector = ({ contact, template: _t, now }) => {
  if (!contact.lastTouchDate) return null;
  const days = Math.floor(
    (now.getTime() - new Date(contact.lastTouchDate).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days < 120) return null;
  const periodMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return {
    periodKey: `dormancy:${periodMonth}`,
    triggerContext: {
      trigger: "DR-01",
      type: "dormancy",
      days_since_last_touch: days,
    },
  };
};

// ---------- Referral-source overdue (no template in base library yet) ----------
// Kept here for completeness — wire to a template when product adds one.
export const referrerOverdueDetector: Detector = ({ contact, now }) => {
  if (contact.relationshipType !== "referral_source") return null;
  if (!contact.lastTouchDate) return null;
  const days = Math.floor(
    (now.getTime() - new Date(contact.lastTouchDate).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days < 60) return null;
  return {
    periodKey: `referrer_overdue:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    triggerContext: {
      trigger: "referrer_overdue",
      days_since_last_touch: days,
    },
  };
};

// ---------- Dispatch table ----------
// Map template id -> detector. Returning `null` means the scheduler evaluates
// nothing for this template id. Event-sourced templates (LR-*, JS-01, LC-*)
// don't have detectors here — they need external event listeners that aren't
// in the scheduler's scope.
export const DETECTORS: Record<string, Detector> = {
  "HA-01": anniversaryDetector,
  "HA-01E": anniversaryDetector,
  "EQ-01": quarterlyEquityDetector,
  "EM-01": equityMilestoneDetector,
  "EM-02": equityMilestoneDetector,
  "DR-01": dormancyDetector,
};
