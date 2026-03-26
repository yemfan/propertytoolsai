import { NextRequest, NextResponse } from "next/server";

/**
 * Proxies Mapbox Search Box `/suggest` so the token is used server-side (browser referrer
 * restrictions on public tokens do not apply the same way as direct `fetch` to api.mapbox.com).
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const sessionToken = req.nextUrl.searchParams.get("session_token")?.trim() ?? "";
  const token =
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? process.env.MAPBOX_ACCESS_TOKEN?.trim() ?? "";

  if (!token) {
    return NextResponse.json({ error: "Mapbox token not configured", suggestions: [] }, { status: 503 });
  }
  if (!q || !sessionToken) {
    return NextResponse.json({ suggestions: [] });
  }

  const url = new URL("https://api.mapbox.com/search/searchbox/v1/suggest");
  url.searchParams.set("q", q);
  url.searchParams.set("session_token", sessionToken);
  url.searchParams.set("access_token", token);
  url.searchParams.set("language", "en");
  url.searchParams.set("country", "US");
  url.searchParams.set("limit", "10");
  // Prefer street addresses; omitting `types` can return POIs — too noisy for property tools.
  url.searchParams.set("types", "address");

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json(
      { error: "Mapbox suggest failed", suggestions: [] },
      { status: 502 }
    );
  }
  try {
    return NextResponse.json(JSON.parse(text) as unknown);
  } catch {
    return NextResponse.json({ error: "Invalid Mapbox response", suggestions: [] }, { status: 502 });
  }
}
