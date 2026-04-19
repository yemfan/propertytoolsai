import { NextResponse } from "next/server";
import { getCurrentConsumerContact } from "@/lib/contacts/consumerContact";
import {
  archiveConsumerSavedSearch,
  updateConsumerSavedSearch,
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

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await getCurrentConsumerContact(req);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      name?: unknown;
      criteria?: unknown;
      alertFrequency?: unknown;
      isActive?: unknown;
    };
    const patch: Parameters<typeof updateConsumerSavedSearch>[2] = {};
    if (typeof body.name === "string") patch.name = body.name;
    if (body.criteria && typeof body.criteria === "object" && !Array.isArray(body.criteria)) {
      patch.criteria = body.criteria as SavedSearchCriteria;
    }
    if (
      typeof body.alertFrequency === "string" &&
      (ALERT_FREQUENCIES as readonly string[]).includes(body.alertFrequency)
    ) {
      patch.alertFrequency = body.alertFrequency as AlertFrequency;
    }
    if (typeof body.isActive === "boolean") patch.isActive = body.isActive;

    const search = await updateConsumerSavedSearch(auth.contactId, id, patch);
    return NextResponse.json({ ok: true, search });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = /does not belong|not found|cannot be empty/i.test(msg) ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await getCurrentConsumerContact(req);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  try {
    const { id } = await ctx.params;
    await archiveConsumerSavedSearch(auth.contactId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = /does not belong|not found/i.test(msg) ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
