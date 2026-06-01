import { NextResponse } from "next/server";
import { getContacts } from "@/lib/dashboardService";

export const runtime = "nodejs";

/**
 * Lightweight contact list for the Outbound AI-call picker.
 *
 * Reuses getContacts() (which resolves the signed-in agent via
 * getCurrentAgentContext + RLS), keeps only rows that actually have a phone
 * number, and projects to the minimal { id, name, phone } the picker needs.
 * Degrades gracefully: on any error it returns an empty list with 200 so the
 * panel's manual phone entry still works.
 */
export async function GET() {
  try {
    const rows = await getContacts(500);
    const contacts = rows
      .filter((c) => typeof c.phone === "string" && c.phone.trim().length > 0)
      .map((c) => ({
        id: String(c.id),
        name: (c.name ?? "").trim() || "Unnamed contact",
        phone: String(c.phone).trim(),
      }));
    return NextResponse.json({ ok: true, contacts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load contacts.";
    console.error("voice/contacts", e);
    return NextResponse.json({ ok: false, error: msg, contacts: [] });
  }
}
