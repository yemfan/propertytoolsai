/**
 * POST /api/expenses/scan
 *
 * Accepts a multipart form with an `image` field (JPEG/PNG/WEBP receipt).
 * Uses Claude claude-opus-4-5 vision to extract:
 *   vendor_name, amount, date, description, category
 *
 * Returns JSON:
 *   { vendor_name, amount, date, description, category, confidence }
 *
 * No auth required beyond the Anthropic API key being present — this route
 * is only callable from within the authenticated dashboard (server-side fetch
 * or from a client within the session).
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const PROMPT = `You are an expense receipt parser. Extract the following fields from this receipt image:

1. vendor_name — The business name (e.g. "Amazon", "Home Depot", "Starbucks")
2. amount — Total amount paid as a positive decimal number (e.g. 47.23). Do NOT include the currency symbol.
3. date — Date of the transaction in YYYY-MM-DD format. If the year is missing, assume the current year.
4. description — A short 3-10 word description of what was purchased (e.g. "Office supplies", "Team lunch", "Software subscription")
5. category — The best matching expense category from this list:
   Advertising & Marketing | Bank Fees | Computer & Software | Dues & Subscriptions |
   Equipment | Insurance | Meals & Entertainment | Office Supplies | Professional Services |
   Rent & Utilities | Repairs & Maintenance | Shipping & Delivery | Travel | Vehicle |
   Other

Respond with ONLY a JSON object in this exact format — no markdown, no code blocks:
{"vendor_name":"...","amount":0.00,"date":"YYYY-MM-DD","description":"...","category":"...","confidence":"high|medium|low"}

If you cannot read a field reliably, set it to null and use confidence "low".`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  let imageData: string;
  let mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";

  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported image type. Please upload a JPEG, PNG, or WebP file." },
        { status: 400 }
      );
    }

    // 10 MB limit
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Image must be under 10 MB" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    imageData = Buffer.from(arrayBuffer).toString("base64");
    mediaType = (file.type === "image/jpg" ? "image/jpeg" : file.type) as typeof mediaType;
  } catch {
    return NextResponse.json({ error: "Failed to read image" }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: imageData },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });

    const rawText = (response.content[0] as { type: string; text: string }).text ?? "";

    // Strip any accidental markdown wrapping
    const cleaned = rawText.replace(/```json\n?|\n?```/g, "").trim();

    let parsed: {
      vendor_name: string | null;
      amount: number | null;
      date: string | null;
      description: string | null;
      category: string | null;
      confidence: string;
    };

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[scan-receipt] JSON parse failed:", rawText);
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[scan-receipt] Anthropic error:", err);
    const msg = err instanceof Error ? err.message : "Failed to scan receipt";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
