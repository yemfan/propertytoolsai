import { supabaseServer } from "@/lib/supabaseServer";
import { sendEmail } from "@/lib/email";

type LeadForNotifications = {
  id: string;
  name: string | null;
  email: string | null;
  search_location: string | null;
  search_radius: number | null;
  price_min: number | null;
  price_max: number | null;
  beds: number | null;
  baths: number | null;
};

export type SmartLeadEventType = "new_listing" | "sold";

function haversineMiles(params: {
  lat1: number;
  lng1: number;
  lat2: number;
  lng2: number;
}) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const R = 3958.8; // Earth radius in miles

  const dLat = toRad(params.lat2 - params.lat1);
  const dLng = toRad(params.lng2 - params.lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(params.lat1)) *
      Math.cos(toRad(params.lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

type GeoResult = { lat: number | null; lng: number | null };

const leadGeoCache = new Map<string, GeoResult | null>();

async function geocodeAddress(addressQuery: string): Promise<GeoResult | null> {
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    "";
  if (!apiKey) return null;
  const q = addressQuery.trim();
  if (!q) return null;

  const cached = leadGeoCache.get(q);
  if (cached !== undefined) return cached;

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        q
      )}&key=${apiKey}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      leadGeoCache.set(q, null);
      return null;
    }
    const json = (await res.json()) as any;
    if (
      json?.status !== "OK" ||
      !Array.isArray(json?.results) ||
      !json.results[0]
    ) {
      leadGeoCache.set(q, null);
      return null;
    }

    const location = json.results[0]?.geometry?.location;
    const lat = typeof location?.lat === "number" ? location.lat : null;
    const lng = typeof location?.lng === "number" ? location.lng : null;

    const out: GeoResult = { lat, lng };
    leadGeoCache.set(q, out);
    return out;
  } catch {
    leadGeoCache.set(q, null);
    return null;
  }
}

function getTodayWindowIso() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function buildEmail(params: {
  leadName: string;
  eventType: SmartLeadEventType;
  propertyAddress: string;
  price: number | null;
  link: string;
}) {
  const { leadName, eventType, propertyAddress, price, link } = params;

  const title =
    eventType === "sold" ? "Recent sale near you" : "New home nearby!";

  const priceText =
    price != null && Number.isFinite(price) ? `$${Math.round(price).toLocaleString()}` : "Price unavailable";

  const body = `Hi ${leadName},

${eventType === "sold" ? "A property near you has recently been sold" : "A property near you has just been listed"}.

Address: ${propertyAddress}
Price: ${priceText}

View details:
${link}

Let me know if you’d like a full report!

Best,
Michael Ye
Real Estate Advisor`;

  return { subject: title, text: body };
}

export async function notifyLeadsForPropertyEvent(params: {
  propertyId: string;
  propertyAddress: string;
  lat: number | null;
  lng: number | null;
  beds: number | null;
  baths: number | null;
  price: number | null;
  eventType: SmartLeadEventType;
}) {
  // Need a valid property location to compute distance.
  if (params.lat == null || params.lng == null) return;

  // Notifications depend on having leads with search settings and an email address.
  let leads: LeadForNotifications[] = [];
  try {
    const { data } = await supabaseServer
      .from("leads")
      .select(
        "id,name,email,search_location,search_radius,price_min,price_max,beds,baths"
      )
      .not("email", "is", null)
      .not("search_location", "is", null);

    leads = (data ?? []) as LeadForNotifications[];
  } catch (e) {
    console.error("notifyLeadsForPropertyEvent: failed to load leads", e);
    return;
  }

  if (!leads.length) return;

  // Match leads using Haversine + optional constraints.
  const matchedCandidates: Array<
    LeadForNotifications & { distanceMiles: number; priceDiff: number }
  > = [];
  const leadGeoById = new Map<string, { lat: number; lng: number }>();
  for (const lead of leads) {
    const geo = await geocodeAddress(String(lead.search_location ?? ""));
    if (geo?.lat == null || geo?.lng == null) continue;
    leadGeoById.set(lead.id, { lat: geo.lat, lng: geo.lng });

    const radius = Number.isFinite(lead.search_radius as any)
      ? (lead.search_radius as number)
      : 2;
    const distanceMiles = haversineMiles({
      lat1: params.lat,
      lng1: params.lng,
      lat2: geo.lat,
      lng2: geo.lng,
    });
    if (distanceMiles > radius) continue;

    // Optional price range.
    if (params.price != null && Number.isFinite(params.price)) {
      if (lead.price_min != null && params.price < lead.price_min) continue;
      if (lead.price_max != null && params.price > lead.price_max) continue;
    } else {
      // If lead specified price bounds, we can't validate without a price.
      if (lead.price_min != null || lead.price_max != null) continue;
    }

    // Optional beds/baths matching.
    if (lead.beds != null) {
      if (params.beds == null || lead.beds !== params.beds) continue;
    }
    if (lead.baths != null) {
      if (params.baths == null || lead.baths !== params.baths) continue;
    }

    // Compute price difference for sorting.
    // When the property price is inside bounds, this will be the distance from the midpoint (or bound).
    const propPrice = params.price != null && Number.isFinite(params.price) ? params.price : null;
    let priceDiff = 0;
    if (propPrice != null) {
      if (lead.price_min != null && lead.price_max != null) {
        const mid = (lead.price_min + lead.price_max) / 2;
        priceDiff = Math.abs(propPrice - mid);
      } else if (lead.price_min != null) {
        priceDiff = Math.abs(propPrice - lead.price_min);
      } else if (lead.price_max != null) {
        priceDiff = Math.abs(propPrice - lead.price_max);
      } else {
        priceDiff = 0;
      }
    }

    matchedCandidates.push({
      ...lead,
      distanceMiles,
      priceDiff,
    });
  }

  if (!matchedCandidates.length) return;

  const matchedLeadIds = matchedCandidates.map((m) => m.id);
  const { startIso, endIso } = getTodayWindowIso();

  // Today's notifications for these leads (rate limiting + best-match replacement).
  let todayNotifs: Array<{
    id: string;
    lead_id: string;
    property_id: string | null;
    type: string;
  }> = [];
  try {
    const { data } = await supabaseServer
      .from("notifications")
      .select("id,lead_id,property_id,type")
      .in("lead_id", matchedLeadIds)
      .gte("sent_at", startIso)
      .lt("sent_at", endIso);
    todayNotifs = (data ?? []) as any;
  } catch (e) {
    console.error("notifyLeadsForPropertyEvent: failed to load today notifications", e);
    return;
  }

  const todayNotifByLeadId = new Map<
    string,
    { id: string; property_id: string | null; type: string }
  >();
  for (const n of todayNotifs) {
    todayNotifByLeadId.set(n.lead_id, {
      id: n.id,
      property_id: n.property_id,
      type: n.type,
    });
  }

  // Dedupe: never re-notify the same lead about the same property for the same event type.
  // (Check any time.)
  let alreadyNotifiedLeadIds = new Set<string>();
  try {
    const { data } = await supabaseServer
      .from("notifications")
      .select("lead_id")
      .in("lead_id", matchedLeadIds)
      .eq("property_id", params.propertyId)
      .eq("type", params.eventType);

    alreadyNotifiedLeadIds = new Set<string>(
      (data ?? []).map((d: any) => String(d.lead_id))
    );
  } catch (e) {
    console.error("notifyLeadsForPropertyEvent: failed to load dedupe notifications", e);
    return;
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || "";
  const link = origin
    ? `${origin}/home-value-estimator?address=${encodeURIComponent(
        params.propertyAddress
      )}`
    : `/home-value-estimator?address=${encodeURIComponent(params.propertyAddress)}`;

  // Load existing property coordinates + prices so we can decide which notification is the "best match".
  const existingPropertyIds = Array.from(
    new Set(
      todayNotifs
        .map((n) => n.property_id)
        .filter((x): x is string => Boolean(x))
    )
  );

  const existingGeoByPropertyId = new Map<string, { lat: number; lng: number }>();
  if (existingPropertyIds.length) {
    try {
      const { data: propGeoRows } = await supabaseServer
        .from("properties_warehouse")
        .select("id,lat,lng")
        .in("id", existingPropertyIds);

      (propGeoRows ?? []).forEach((r: any) => {
        if (r?.lat == null || r?.lng == null) return;
        existingGeoByPropertyId.set(String(r.id), { lat: r.lat, lng: r.lng });
      });
    } catch (e) {
      console.error("notifyLeadsForPropertyEvent: failed to load existing property lat/lng", e);
    }
  }

  const existingPriceByPropertyId = new Map<string, number | null>();
  if (existingPropertyIds.length) {
    try {
      const { data: snapRows } = await supabaseServer
        .from("property_snapshots_warehouse")
        .select("property_id,estimated_value,created_at")
        .in("property_id", existingPropertyIds)
        .order("created_at", { ascending: false })
        .limit(Math.max(20, existingPropertyIds.length * 5));

      for (const r of snapRows ?? []) {
        const pid = String(r.property_id);
        if (existingPriceByPropertyId.has(pid)) continue;
        existingPriceByPropertyId.set(pid, r.estimated_value != null ? Number(r.estimated_value) : null);
      }
    } catch (e) {
      console.error("notifyLeadsForPropertyEvent: failed to load existing property prices", e);
    }
  }

  const sortedMatches = [...matchedCandidates].sort((a, b) => {
    // Prioritize closest matches first, then closest price matches.
    if (a.distanceMiles !== b.distanceMiles) return a.distanceMiles - b.distanceMiles;
    return a.priceDiff - b.priceDiff;
  });

  // Send or replace today's notification per lead:
  // - If none exists: insert + send email
  // - If exists: replace only if the new property is "better" (distance then priceDiff)
  for (const lead of sortedMatches) {
    if (alreadyNotifiedLeadIds.has(lead.id)) continue;

    const existingToday = todayNotifByLeadId.get(lead.id);

    const leadName = lead.name ?? "there";
    const email = buildEmail({
      leadName,
      eventType: params.eventType,
      propertyAddress: params.propertyAddress,
      price: params.price,
      link,
    });

    if (!existingToday) {
      try {
        await sendEmail({
          to: String(lead.email),
          subject: email.subject,
          text: email.text,
        });

        await supabaseServer.from("notifications").insert({
          lead_id: lead.id,
          property_id: params.propertyId,
          type: params.eventType,
          message: email.text,
        });
      } catch (e) {
        console.error("notifyLeadsForPropertyEvent: send failed", e);
      }
      continue;
    }

    const existingPropertyId = existingToday.property_id;
    if (!existingPropertyId) continue;

    const existingGeo = existingGeoByPropertyId.get(existingPropertyId);
    if (!existingGeo) continue;

    const existingPrice = existingPriceByPropertyId.get(existingPropertyId) ?? null;

    const leadGeo = leadGeoById.get(lead.id);
    if (!leadGeo) continue;

    // Compare lead-to-property distance (same metric used for candidate sorting).
    const existingDistanceMiles = haversineMiles({
      lat1: leadGeo.lat,
      lng1: leadGeo.lng,
      lat2: existingGeo.lat,
      lng2: existingGeo.lng,
    });

    // Compute the price difference using the same lead bounds used for sorting.
    let existingPriceDiff = 0;
    if (existingPrice != null && Number.isFinite(existingPrice)) {
      if (lead.price_min != null && lead.price_max != null) {
        const mid = (lead.price_min + lead.price_max) / 2;
        existingPriceDiff = Math.abs(existingPrice - mid);
      } else if (lead.price_min != null) {
        existingPriceDiff = Math.abs(existingPrice - lead.price_min);
      } else if (lead.price_max != null) {
        existingPriceDiff = Math.abs(existingPrice - lead.price_max);
      } else {
        existingPriceDiff = 0;
      }
    }

    const isBetter =
      lead.distanceMiles < existingDistanceMiles ||
      (lead.distanceMiles === existingDistanceMiles &&
        lead.priceDiff < existingPriceDiff);

    if (!isBetter) continue;

    // Replace the existing record and re-email with the better match.
    try {
      await sendEmail({
        to: String(lead.email),
        subject: email.subject,
        text: email.text,
      });

      await supabaseServer.from("notifications").update({
        property_id: params.propertyId,
        type: params.eventType,
        message: email.text,
        sent_at: new Date().toISOString(),
      }).eq("id", existingToday.id);
    } catch (e) {
      console.error("notifyLeadsForPropertyEvent: replacement send failed", e);
    }
  }
}

