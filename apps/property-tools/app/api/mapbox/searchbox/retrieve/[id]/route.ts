import { NextRequest, NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Proxies Mapbox Search Box `/retrieve/{id}` (same session_token as `/suggest`).
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { id: rawId } = await ctx.params;
  const id = decodeURIComponent(rawId ?? "").trim();
  const sessionToken = req.nextUrl.searchParams.get("session_token")?.trim() ?? "";
  const token =
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? process.env.MAPBOX_ACCESS_TOKEN?.trim() ?? "";

  if (!token) {
    return NextResponse.json({ error: "Mapbox token not configured" }, { status: 503 });
  }
  if (!id || !sessionToken) {
    return NextResponse.json({ error: "Missing id or session_token" }, { status: 400 });
  }

  const url = new URL(`https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(id)}`);
  url.searchParams.set("session_token", sessionToken);
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json({ error: "Mapbox retrieve failed" }, { status: 502 });
  }
  try {
    return NextResponse.json(JSON.parse(text) as unknown);
  } catch {
    return NextResponse.json({ error: "Invalid Mapbox response" }, { status: 502 });
  }
}
