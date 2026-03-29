export type ListingPlatform = "zillow" | "redfin";

export function detectPlatform(inputUrl: string): ListingPlatform | null {
  if (/zillow\.com/i.test(inputUrl)) return "zillow";
  if (/redfin\.com/i.test(inputUrl)) return "redfin";
  return null;
}

export function extractListingId(
  inputUrl: string,
  platform: ListingPlatform
): string | null {
  if (platform === "zillow") {
    const match = inputUrl.match(/\/(\d+)_zpid/i);
    return match ? match[1] : null;
  }
  if (platform === "redfin") {
    const match = inputUrl.match(/\/home\/(\d+)/i);
    return match ? match[1] : null;
  }
  return null;
}

function prettifyAddressSegment(seg: string): string {
  // Redfin: "123-Main-St-Los-Angeles-CA-90001" -> "123 Main St, Los Angeles, CA 90001"
  // Zillow: similar "123-Main-St-Los-Angeles-CA-90001/12345678_zpid/"
  const cleaned = seg.replace(/\.html?$/i, "").replace(/\/+$/, "");
  const tokens = cleaned.split("-").filter(Boolean);
  if (tokens.length < 4) return decodeURIComponent(cleaned).replace(/-/g, " ");

  // Heuristic: last token is ZIP if 5 digits; token before is state if 2 letters.
  const last = tokens[tokens.length - 1];
  const maybeZip = /^\d{5}(-\d{4})?$/.test(last) ? last : null;
  const maybeState = tokens[tokens.length - (maybeZip ? 2 : 1)];
  const state = /^[A-Za-z]{2}$/.test(maybeState) ? maybeState.toUpperCase() : null;

  const coreEnd = tokens.length - (maybeZip ? 2 : 0) - (state ? 1 : 0);
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

    // Redfin path often includes ".../<address-segment>/home/<id>"
    // Zillow often includes ".../<address-segment>/<zpid>_zpid/"
    const path = u.pathname.replace(/\/+/g, "/");
    const parts = path.split("/").filter(Boolean);

    if (platform === "zillow") {
      // Find the segment before "<zpid>_zpid"
      const zpidIdx = parts.findIndex((p) => /_zpid$/i.test(p));
      if (zpidIdx > 0) return prettifyAddressSegment(parts[zpidIdx - 1]);
      // Fallback: first long segment
      const cand = parts.find((p) => p.includes("-") && p.length > 10);
      return cand ? prettifyAddressSegment(cand) : null;
    }

    if (platform === "redfin") {
      const homeIdx = parts.findIndex((p) => p.toLowerCase() === "home");
      if (homeIdx > 0) return prettifyAddressSegment(parts[homeIdx - 1]);
      const cand = parts.find((p) => p.includes("-") && p.length > 10);
      return cand ? prettifyAddressSegment(cand) : null;
    }

    return null;
  } catch {
    return null;
  }
}

