import { NextResponse } from "next/server";

const GOOGLE_PLACES_AUTOCOMPLETE_URL =
  "https://maps.googleapis.com/maps/api/place/autocomplete/json";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";

  if (!query) {
    return NextResponse.json({ predictions: [] });
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", predictions: [] },
      { status: 500 }
    );
  }

  const url = new URL(GOOGLE_PLACES_AUTOCOMPLETE_URL);
  url.searchParams.set("input", query);
  url.searchParams.set("types", "geocode");
  url.searchParams.set("components", "country:us");
  url.searchParams.set("key", apiKey);

  const upstream = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Google Places autocomplete upstream failure", predictions: [] },
      { status: 502 }
    );
  }

  const json = (await upstream.json()) as {
    status?: string;
    error_message?: string;
    predictions?: unknown[];
  };

  if (json.status && json.status !== "OK" && json.status !== "ZERO_RESULTS") {
    return NextResponse.json(
      {
        error: json.error_message || `Google Places status: ${json.status}`,
        predictions: [],
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ predictions: Array.isArray(json.predictions) ? json.predictions : [] });
}
