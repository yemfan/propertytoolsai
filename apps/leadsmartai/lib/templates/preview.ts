/**
 * Render a template body/subject against a mocked contact.
 * The handoff flags that "preview uses one mocked contact today — backend should
 * support multiple preview archetypes eventually". Only one archetype is shipped
 * in this first PR; add more below when product picks the set.
 */

export type PreviewArchetype = "past_buyer_client_with_equity";

type PreviewContact = Record<string, string>;

const ARCHETYPES: Record<PreviewArchetype, PreviewContact> = {
  past_buyer_client_with_equity: {
    first_name: "Jamie",
    last_name: "Chen",
    street_name: "Maple Ave",
    property_address: "1823 Maple Ave, Seattle, WA",
    property_short_address: "1823 Maple Ave",
    address: "1823 Maple Ave, Seattle, WA",
    address_short: "1819 Maple Ave",
    closing_date: "2022-04-14",
    closing_date_short: "April 2022",
    closing_price_display: "$812,000",
    closing_year: "2022",
    avm_display: "$1,025,000",
    delta_display: "$213,000",
    delta_pct: "26",
    years: "2",
    s: "s",
    quarter: "Q2 2026",
    neighborhood: "Wallingford",
    median_price: "$985,000",
    dom_change_phrase: "shortened from 18 to 12 days",
    sold_price: "$1,040,000",
    bathrooms: "2",
    square_footage: "1,620",
    tour_day: "Saturday",
    tour_time: "2:30pm",
    referral_name: "Alex",
    price_max: "$1.1M",
    season: "spring",
    leads_received: "42",
    leads_replied: "18",
    tours_booked: "6",
    median_latency: "47",
    reply_time: "3:42pm",
    lead_name: "Alex Rivera",
    source: "Zillow",
    arrival_time: "3:41pm",
    first_reply_time: "3:41pm",
    reply_latency: "38",
    trial_end_date: "April 19",
    current_median_latency: "47",
    old_median_latency: "92",
    connect_url: "https://leadsmart.ai/connect",
    voice_url: "https://leadsmart.ai/voice",
    upgrade_url: "https://leadsmart.ai/upgrade",
    reactivate_url: "https://leadsmart.ai/reactivate",
    agent_first_name: "Michael",
    agent_phone: "(206) 555-0199",
    agent_car: "grey Tesla",
    brokerage: "Hie Estates",
    founder_first_name: "Alice",
  },
};

export function availableArchetypes(): PreviewArchetype[] {
  return Object.keys(ARCHETYPES) as PreviewArchetype[];
}

function fill(body: string, ctx: PreviewContact): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => {
    const v = ctx[key];
    return typeof v === "string" ? v : `{{${key}}}`;
  });
}

export function renderPreview({
  subject,
  body,
  archetype = "past_buyer_client_with_equity",
}: {
  subject: string | null;
  body: string;
  archetype?: PreviewArchetype;
}): { subject: string | null; body: string } {
  const ctx = ARCHETYPES[archetype] ?? ARCHETYPES.past_buyer_client_with_equity;
  return {
    subject: subject ? fill(subject, ctx) : null,
    body: fill(body, ctx),
  };
}
