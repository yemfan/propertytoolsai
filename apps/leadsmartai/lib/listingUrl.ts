/**
 * Property listing URL detector + parser.
 *
 * Used by:
 *   - /api/property/from-listing  — agent pastes a URL, we look up
 *     the property data warehouse for it
 *   - /dashboard/showings/new and other property forms — auto-fill
 *     address fields when the agent pastes a recognized URL
 *
 * Adding a new platform: extend the discriminated union, add a
 * domain-match in `detectPlatform`, plus parsers in `extractListingId`
 * + `extractAddressFromListingUrl`. Verify against a couple of real
 * URLs from the platform — slug formats drift over time.
 */

export type ListingPlatform = "zillow" | "redfin" | "realtor" | "compass";

export const SUPPORTED_PLATFORMS: readonly ListingPlatform[] = [
  "zillow",
  "redfin",
  "realtor",
  "compass",
] as const;

/** Human-readable label for a platform. UI badge text. */
export function platformLabel(platform: ListingPlatform): string {
  switch (platform) {
    case "zillow":
      return "Zillow";
    case "redfin":
      return "Redfin";
    case "realtor":
      return "Realtor.com";
    case "compass":
      return "Compass";
  }
}

export function detectPlatform(inputUrl: string): ListingPlatform | null {
  if (/zillow\.com/i.test(inputUrl)) return "zillow";
  if (/redfin\.com/i.test(inputUrl)) return "redfin";
  if (/realtor\.com/i.test(inputUrl)) return "realtor";
  if (/compass\.com/i.test(inputUrl)) return "compass";
  return null;
}

export function extractListingId(
  inputUrl: string,
  platform: ListingPlatform,
): string | null {
  if (platform === "zillow") {
    const match = inputUrl.match(/\/(\d+)_zpid/i);
    return match ? match[1] : null;
  }
  if (platform === "redfin") {
    const match = inputUrl.match(/\/home\/(\d+)/i);
    return match ? match[1] : null;
  }
  if (platform === "realtor") {
    // Realtor URLs end with `_M<digits>-<digits>` — keep the whole
    // chunk as the id since both halves are needed to round-trip.
    const match = inputUrl.match(/_M(\d+-\d+)/i);
    return match ? `M${match[1]}` : null;
  }
  if (platform === "compass") {
    // Compass URLs: `/listing/<address-slug>/<numeric-id>`
    // The id is the last path segment, strip query/hash first.
    const cleaned = inputUrl.split(/[?#]/)[0];
    const match = cleaned.match(/\/listing\/[^/]+\/(\d+)/i);
    return match ? match[1] : null;
  }
  return null;
}

function prettifyAddressSegment(seg: string): string {
  // Normalize: "123-Main-St-Los-Angeles-CA-90001" → "123 Main St, Los Angeles, CA 90001"
  // Realtor uses underscores for the major separators ("_") with hyphens
  // inside each component — we collapse both to a single token list and
  // re-segment by detecting state + ZIP at the tail.
  const cleaned = seg.replace(/\.html?$/i, "").replace(/\/+$/, "");
  // Split on either "_" (Realtor's component separator) or "-" (Zillow/Redfin/Compass).
  const tokens = cleaned.split(/[-_]/).filter(Boolean);
  if (tokens.length < 4) return decodeURIComponent(cleaned).replace(/[-_]/g, " ");

  // Heuristic: last token is ZIP if 5 digits; token before is state if 2 letters.
  const last = tokens[tokens.length - 1];
  const maybeZip = /^\d{5}(-\d{4})?$/.test(last) ? last : null;
  const maybeState = tokens[tokens.length - (maybeZip ? 2 : 1)];
  const state = /^[A-Za-z]{2}$/.test(maybeState) ? maybeState.toUpperCase() : null;

  const coreEnd = tokens.length - (maybeZip ? 1 : 0) - (state ? 1 : 0);
  const core = tokens.slice(0, coreEnd);

  // Split core into street + city using the last 2 tokens as city if long enough.
  const streetTokens = core.slice(0, Math.max(2, core.length - 2));
  const cityTokens = core.slice(streetTokens.length);

  const street = streetTokens.join(" ");
  const city = cityTokens.join(" ");

  const parts = [street];
  if (city) parts.push(city);
  if (state) parts.push(state);
  if (maybeZip) parts.push(maybeZip);

  return parts.join(", ");
}

export function extractAddressFromListingUrl(inputUrl: string): string | null {
  try {
    const u = new URL(inputUrl);
    const platform = detectPlatform(inputUrl);
    if (!platform) return null;

    const path = u.pathname.replace(/\/+/g, "/");
    const parts = path.split("/").filter(Boolean);

    if (platform === "zillow") {
      // Find the segment before "<zpid>_zpid"
      const zpidIdx = parts.findIndex((p) => /_zpid$/i.test(p));
      if (zpidIdx > 0) return prettifyAddressSegment(parts[zpidIdx - 1]);
      // Fallback: first long hyphenated segment
      const cand = parts.find((p) => p.includes("-") && p.length > 10);
      return cand ? prettifyAddressSegment(cand) : null;
    }

    if (platform === "redfin") {
      const homeIdx = parts.findIndex((p) => p.toLowerCase() === "home");
      if (homeIdx > 0) return prettifyAddressSegment(parts[homeIdx - 1]);
      const cand = parts.find((p) => p.includes("-") && p.length > 10);
      return cand ? prettifyAddressSegment(cand) : null;
    }

    if (platform === "realtor") {
      // Realtor URL: /realestateandhomes-detail/<address-segment>
      // The address segment uses underscores between components and
      // hyphens within each component. The trailing _M<digits> is the
      // listing id; strip it before prettifying.
      const detailIdx = parts.findIndex((p) =>
        /^realestateandhomes-detail$/i.test(p),
      );
      if (detailIdx >= 0 && detailIdx < parts.length - 1) {
        const seg = parts[detailIdx + 1].replace(/_M\d+-\d+$/i, "");
        return prettifyAddressSegment(seg);
      }
      // Fallback: any long segment with separators
      const cand = parts.find((p) => /[-_]/.test(p) && p.length > 10);
      return cand ? prettifyAddressSegment(cand) : null;
    }

    if (platform === "compass") {
      // Compass URL: /listing/<address-slug>/<numeric-id>
      const listingIdx = parts.findIndex((p) => p.toLowerCase() === "listing");
      if (listingIdx >= 0 && listingIdx < parts.length - 1) {
        return prettifyAddressSegment(parts[listingIdx + 1]);
      }
      // Fallback: first long hyphenated segment
      const cand = parts.find((p) => p.includes("-") && p.length > 10);
      return cand ? prettifyAddressSegment(cand) : null;
    }

    return null;
  } catch {
    return null;
  }
}
