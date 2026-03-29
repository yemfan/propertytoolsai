import { NextResponse } from "next/server";
import { getOpenAIConfig } from "@/lib/ai/openaiClient";
import type { UserProfile } from "@/lib/userProfile";
import type { RecommendedAction } from "@/lib/recommendation";

export const runtime = "nodejs";

type Body = {
  profile?: UserProfile;
  actions?: RecommendedAction[];
};

/**
 * Optional OpenAI layer: short explanation for why these actions fit the user.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const profile = body.profile;
    const actions = Array.isArray(body.actions) ? body.actions : [];
    if (!profile) {
      return NextResponse.json({ ok: false, error: "profile required" }, { status: 400 });
    }

    const { apiKey, model } = getOpenAIConfig();
    if (!apiKey) {
      return NextResponse.json({
        ok: true,
        explanation: null,
        skipped: true,
        reason: "no_openai_key",
      });
    }

    const summary = {
      intent: profile.intent,
      urgency: profile.urgency,
      location: profile.location,
      priceRange: profile.priceRange,
      signals: profile.signals,
    };

    const actionLines = actions
      .slice(0, 6)
      .map((a) => `- ${a.title} (${a.priority}): ${a.reason}`)
      .join("\n");

    const prompt = `You are a product assistant for PropertyTools AI (real estate calculators and AI tools for buyers, sellers, and investors).

Based on this inferred user profile (from on-site behavior):
${JSON.stringify(summary, null, 2)}

We are showing these recommended next actions:
${actionLines || "(none)"}

Write 2–3 short sentences explaining why these steps make sense for this user right now. Be specific to intent and urgency. No bullet list. Plain English.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 220,
        messages: [
          { role: "system", content: "You help users prioritize real estate tools. Be concise." },
          { role: "user", content: prompt },
        ],
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn("behavior-recommendations OpenAI error", res.status, json);
      return NextResponse.json({
        ok: true,
        explanation: null,
        skipped: true,
        reason: "openai_error",
      });
    }

    const text = String(json?.choices?.[0]?.message?.content ?? "").trim();
    return NextResponse.json({
      ok: true,
      explanation: text || null,
    });
  } catch (e: any) {
    console.error("POST /api/ai/behavior-recommendations", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
