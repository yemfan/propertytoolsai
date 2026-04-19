import { NextResponse } from "next/server";
import { getCurrentConsumerContact } from "@/lib/contacts/consumerContact";
import {
  createConsumerSavedSearch,
  listConsumerSavedSearches,
} from "@/lib/contacts/savedSearches";
import type {
  AlertFrequency,
  SavedSearchCriteria,
} from "@/lib/contacts/types";

export const runtime = "nodejs";

const ALERT_FREQUENCIES: readonly AlertFrequency[] = [
  "instant",
  "daily",
  "weekly",
  "never",
];

export async function GET(req: Request) {
  const ctx = await getCurrentConsumerContact(req);
  if (!ctx) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 },
    );
  }
  try {
    const url = new URL(req.url);
    const includeArchived = url.searchParams.get("includeArchived") === "1";
    const searches = await listConsumerSavedSearches(ctx.contactId, {
      includeArchived,
    });
    return NextResponse.json({ ok: true, searches });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const ctx = await getCurrentConsumerContact(req);
  if (!ctx) {
    return NextResponse.json(
      { ok: false, error: "Sign in to save searches" },
      { status: 401 },
    );
  }
  try {
    const body = (await req.json()) as {
      name?: unknown;
      criteria?: unknown;
      alertFrequency?: unknown;
    };
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { ok: false, error: "name required" },
        { status: 400 },
      );
    }
    const criteria: SavedSearchCriteria =
      body.criteria && typeof body.criteria === "object" && !Array.isArray(body.criteria)
        ? (body.criteria as SavedSearchCriteria)
        : {};
    const alertFrequency =
      typeof body.alertFrequency === "string" &&
      (ALERT_FREQUENCIES as readonly string[]).includes(body.alertFrequency)
        ? (body.alertFrequency as AlertFrequency)
        : undefined;

    const search = await createConsumerSavedSearch(ctx.contactId, {
      name: body.name,
      criteria,
      alertFrequency,
    });
    return NextResponse.json({ ok: true, search });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
