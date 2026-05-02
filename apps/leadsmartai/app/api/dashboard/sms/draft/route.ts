import OpenAI from "openai";
import { NextResponse } from "next/server";

import { getCurrentAgentContext } from "@/lib/dashboardService";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * POST /api/dashboard/sms/draft
 *
 * Body: `{ contactId: string, prompt: string }`
 * Returns: `{ ok: true, draft: string }`
 *
 * Drafts a short SMS for the given contact, guided by the agent's
 * free-form prompt (e.g. "ask about their financing", "confirm
 * tomorrow's showing"). Used by the AI Guide tabbed panel —
 * separate from `/api/ai-sms/reply` (which replies to inbound SMS).
 */
export async function POST(req: Request) {
  try {
    const { agentId } = await getCurrentAgentContext();
    if (!agentId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      contactId?: string;
      prompt?: string;
    };
    const contactId = String(body.contactId ?? "").trim();
    const prompt = String(body.prompt ?? "").trim();
    if (!contactId || !prompt) {
      return NextResponse.json(
        { ok: false, error: "contactId and prompt are required" },
        { status: 400 },
      );
    }

    const { data: contact, error: contactErr } = await supabaseAdmin
      .from("contacts")
      .select("id, agent_id, name, first_name, last_name, email, phone, property_address, rating, notes_summary")
      .eq("id", contactId)
      .maybeSingle();
    if (contactErr) throw contactErr;
    if (!contact) {
      return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });
    }
    if (String(contact.agent_id) !== String(agentId)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const fallback = `Hi${contact.first_name ? ` ${contact.first_name}` : ""} — just checking in. ${prompt}`;
    if (!apiKey) {
      return NextResponse.json({ ok: true, draft: fallback });
    }

    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_SMS_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

    const composedName =
      contact.name ??
      ([contact.first_name, contact.last_name].filter(Boolean).join(" ") || null);
    const contactSummary = JSON.stringify({
      name: composedName,
      phone: contact.phone,
      property: contact.property_address,
      rating: contact.rating,
      summary: contact.notes_summary,
    });

    try {
      const response = await client.chat.completions.create({
        model,
        temperature: 0.5,
        messages: [
          {
            role: "system",
            content:
              "You draft short, warm, professional SMS messages for a real-estate agent to send their contact. Keep it under 320 characters. Single message — no labels, no quotes, no greeting boilerplate beyond a first-name salutation when known. Plain text only.",
          },
          {
            role: "user",
            content: `Contact: ${contactSummary}\n\nWhat the agent wants to say:\n${prompt}\n\nWrite the SMS.`,
          },
        ],
      });
      const draft = response.choices?.[0]?.message?.content?.trim();
      if (!draft) {
        return NextResponse.json({ ok: true, draft: fallback });
      }
      return NextResponse.json({ ok: true, draft });
    } catch {
      return NextResponse.json({ ok: true, draft: fallback });
    }
  } catch (e) {
    console.error("[sms/draft] failed", e);
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
