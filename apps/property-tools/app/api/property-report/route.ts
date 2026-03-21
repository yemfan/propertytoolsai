import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  // Placeholder "save" handler. In production, persist to your database here.
  console.log("Received property report payload:", body);

  return NextResponse.json({ ok: true });
}

