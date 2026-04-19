import { NextResponse } from "next/server";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import {
  createSavedSearch,
  listSavedSearches,
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

function parseFrequency(v: unknown): AlertFrequency | undefined {
  return typeof v === "string" && (ALERT_FREQUENCIES as readonly string[]).includes(v)
    ? (v as AlertFrequency)
    : undefined;
}

function parseCriteria(v: unknown): SavedSearchCriteria {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as SavedSearchCriteria;
}

export async function GET(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const url = new URL(req.url);
    const contactId = url.searchParams.get("contactId") ?? undefined;
    const includeArchived = url.searchParams.get("includeArchived") === "1";
    const searches = await listSavedSearches(agentId, {
      contactId,
      includeArchived,
    });
    return NextResponse.json({ ok: true, searches });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    const body = (await req.json()) as {
      contactId?: unknown;
      name?: unknown;
      criteria?: unknown;
      alertFrequency?: unknown;
    };

    if (typeof body.contactId !== "string" || !body.contactId.trim()) {
      return NextResponse.json(
        { ok: false, error: "contactId required" },
        { status: 400 },
      );
    }
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { ok: false, error: "name required" },
        { status: 400 },
      );
    }

    const search = await createSavedSearch(agentId, {
      contactId: body.contactId,
      name: body.name,
      criteria: parseCriteria(body.criteria),
      alertFrequency: parseFrequency(body.alertFrequency),
    });
    return NextResponse.json({ ok: true, search });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = /does not belong|not found/i.test(msg) ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
