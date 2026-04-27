import type { MonetizationRow } from "@/lib/sphereMonetization/mergeRows";

/**
 * Pure projection helpers for the sphere-drip enrollment overlay.
 *
 * Lives in its own file (no `server-only`) so vitest can hit it directly
 * without the supabaseAdmin shim that's loaded by lib/sphereDrip/service.ts.
 */

export type DripEnrollmentRow = {
  id: string;
  agentId: string;
  contactId: string;
  cadenceKey: string;
  enrolledAt: string;
  currentStep: number;
  status: "active" | "paused" | "completed" | "exited";
  lastSentAt: string | null;
  nextDueAt: string | null;
  completedAt: string | null;
  exitReason: string | null;
};

export type MonetizationRowWithEnrollment = MonetizationRow & {
  enrollment: DripEnrollmentRow | null;
};

/**
 * Build a contactId → enrollment lookup. O(n) projection used by the
 * monetization panel + the per-row overlay below.
 */
export function indexEnrollmentsByContact(
  enrollments: ReadonlyArray<DripEnrollmentRow>,
): Map<string, DripEnrollmentRow> {
  return new Map(enrollments.map((e) => [e.contactId, e]));
}

/**
 * Decorate monetization rows with their enrollment state. Pure projection
 * — caller fetches both lists, this stitches them together. Lives here
 * (not in the merger) so the merger stays free of the drip dependency.
 */
export function attachEnrollments(
  rows: ReadonlyArray<MonetizationRow>,
  enrollments: ReadonlyArray<DripEnrollmentRow>,
): MonetizationRowWithEnrollment[] {
  const idx = indexEnrollmentsByContact(enrollments);
  return rows.map((r) => ({ ...r, enrollment: idx.get(r.contactId) ?? null }));
}
