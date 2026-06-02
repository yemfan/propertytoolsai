import { NextResponse } from "next/server";
import { getContacts } from "@/lib/dashboardService";

export const runtime = "nodejs";

/**
 * Lightweight contact list for the invoice "bill to" picker — { id, name, email }
 * for the signed-in agent's contacts. Degrades to an empty list so manual entry
 * always works.
 */
export async function GET() {
  try {
    const rows = await getContacts(500);
    const contacts = rows.map((c) => ({
      id: String(c.id),
      name: (c.name ?? "").trim() || "Unnamed contact",
      email: (c.email ?? "").trim(),
    }));
    return NextResponse.json({ ok: true, contacts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load contacts.";
    console.error("books/contacts", e);
    return NextResponse.json({ ok: false, error: msg, contacts: [] });
  }
}
