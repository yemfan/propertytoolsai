/**
 * Pinned identifiers for the EXACT consent-disclosure text shown on
 * each public form. Bump the version (and snapshot the prior text in
 * `archive/` when you do) whenever the on-screen disclosure changes
 * materially — e.g. adding/removing the "consent is not a condition"
 * line, changing "customer care + marketing" to a narrower scope, etc.
 *
 * The audit table (`inbound_contact_requests.consent_disclosure_version`)
 * stores whichever value was current at submit time, so we can prove
 * what the consenting party saw even after the live form is edited.
 */

/**
 * /contact form (LeadSmart AI marketing site).
 *
 * v1.0 — initial — shipped 2026-04-27 in PR #168. Disclosure text:
 *   "Yes, send me text messages from LeadSmart AI. By checking this
 *    box and providing my phone number above, I consent to receive
 *    text messages from LeadSmart AI for customer care and marketing
 *    related to real-estate services, account updates, and product
 *    information.
 *    Message frequency varies. Message and data rates may apply.
 *    Reply STOP to opt out at any time, or HELP for help. Consent is
 *    not a condition of any purchase. See our Privacy Policy and
 *    Terms of Service for details."
 */
export const CONTACT_FORM_DISCLOSURE_VERSION = "v1.0_2026-04-27";

/**
 * /oh/[slug] open-house sign-in form.
 *
 * v1.0 — initial — shipped alongside PR-H. The form's "marketing
 * consent" checkbox doubles as SMS opt-in (the existing instant-reply
 * flow from PR #164 only fires when this box is ticked + visitor is
 * non-agented). Disclosure text:
 *   "Yes, I agree to receive marketing communications (text + email)
 *    from the listing agent about this property and similar
 *    listings. Message frequency varies. Message and data rates may
 *    apply. Reply STOP to opt out at any time. Consent is not a
 *    condition of any purchase or service."
 *
 * Bump the version (and snapshot the prior text in this comment)
 * whenever the on-screen disclosure changes materially.
 */
export const OPEN_HOUSE_SIGNIN_DISCLOSURE_VERSION = "v1.0_2026-04-27";

/**
 * /api/idx/lead-capture (IDX consumer modal — favorite, save_search,
 * schedule_tour, contact_agent, view_threshold).
 *
 * v1.0 — initial — shipped alongside PR-H. The modal's TCPA opt-in
 * checkbox is required for the SMS-path; the audit row captures
 * whether it was ticked. Disclosure text:
 *   "By providing my phone number, I agree to receive text messages
 *    about this listing and related opportunities from this agent.
 *    Message frequency varies. Message and data rates may apply.
 *    Reply STOP to opt out at any time."
 */
export const IDX_LEAD_CAPTURE_DISCLOSURE_VERSION = "v1.0_2026-04-27";

/**
 * Stable source identifiers for the audit table. Keep them
 * machine-friendly (no spaces, no localized variations) so they group
 * cleanly when querying the table by source.
 */
export const CONSENT_SOURCE_CONTACT_FORM = "/contact";
export const CONSENT_SOURCE_OPEN_HOUSE_SIGNIN = "open_house_signin";
export const CONSENT_SOURCE_IDX_LEAD_CAPTURE = "idx_lead_capture";
