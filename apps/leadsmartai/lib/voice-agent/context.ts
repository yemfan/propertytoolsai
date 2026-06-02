import { getAgentDisplayName } from "@/lib/ai-call/lead-resolution";
import { getReceptionistConfig, getBookingSettings } from "@/lib/voice-receptionist/settings";
import {
  describeHours,
  defaultBusinessHours,
  type ReceptionistContext,
} from "@repo/voice";

/**
 * Build the shared `ReceptionistContext` for a LeadSmart agent from its saved
 * Voice Receptionist config (Settings → Voice → AI Voice Receptionist), falling
 * back to the account display name + sensible defaults when a field is unset.
 *
 * Returns `null` when the receptionist is disabled, so the Retell inbound webhook
 * serves no dynamic variables (the agent answers with no prompt = effectively
 * off). The config table may not exist yet — `getReceptionistConfig` returns
 * defaults on any error, so this keeps working before the migration is applied.
 *
 * Additive — LeadSmart's existing Twilio/OpenAI-Realtime voice is untouched.
 */

/** Validate a user-entered IANA timezone; fall back if invalid (e.g. a typo). */
function safeTimezone(tz: string | undefined | null): string {
  const v = (tz || "").trim();
  if (v) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: v });
      return v;
    } catch {
      /* invalid tz (e.g. "America/Los_Angles") — fall through to default */
    }
  }
  return "America/New_York";
}

export async function loadReceptionistContext(
  agentId: string,
): Promise<ReceptionistContext | null> {
  const cfg = await getReceptionistConfig(agentId);
  if (!cfg.enabled) return null;

  // Booking on/off + per-agent office hours (one query). Booking off by default;
  // hours fall back to the engine default (Mon–Fri 9–5) when unset.
  const { enabled: bookingEnabled, hours: configuredHours } = await getBookingSettings(agentId);
  const hours = configuredHours ?? defaultBusinessHours();

  // Only look up the account display name when no business name is configured —
  // skips two DB round-trips (agents + user_profiles) on the call's hot path.
  const orgName = cfg.businessName || (await getAgentDisplayName(agentId)) || "our team";
  const timezone = safeTimezone(cfg.timezone);
  const todayISO = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return {
    orgId: agentId,
    orgName,
    orgNameZh: cfg.businessNameZh || orgName,
    agentName: cfg.agentName || "",
    twilioNumber: null,
    timezone,
    todayISO,
    todayLabel,
    hoursText: describeHours(hours),
    // When booking is on, the agent offers 30-minute appointments via the Retell
    // check_availability / book_appointment tools (backed by /api/retell/function).
    // When off, steer callers to a message / call-back instead.
    typesText: bookingEnabled
      ? "30-minute appointments you can book: property showings, buyer consultations, listing consultations, and general meetings. Use check_availability first, then book_appointment."
      : "No online appointment booking. If the caller wants to schedule, take a message or offer a call-back.",
    knowledgeText: cfg.extraNotes || "",
    extraNotes: "",
    greeting: cfg.greeting || "",
  };
}
