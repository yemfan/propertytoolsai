// Pure appointment-service primitives shared by the receptionist booking engine.
// The conflict-detection + availability math lives in @repo/voice/scheduling; these
// are the small, presentation-level rules (naming, defaults) that every booking
// surface should apply identically. No I/O.

/** Fallback duration when an appointment type carries none. */
export const DEFAULT_APPOINTMENT_MINUTES = 30;

/**
 * Split a free-form caller name into first/last for a lightweight client record.
 * Empty input yields a friendly placeholder first name and no last name.
 */
export function splitCallerName(name?: string | null): { firstName: string; lastName: string | null } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "Caller",
    lastName: parts.slice(1).join(" ") || null,
  };
}

/** Compose an appointment title from the type name and (optionally) the caller. */
export function appointmentTitle(typeName: string | null | undefined, callerName?: string | null): string {
  const base = typeName?.trim() || "Appointment";
  const caller = callerName?.trim();
  return caller ? `${base} — ${caller}` : base;
}
