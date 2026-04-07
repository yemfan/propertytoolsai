/**
 * Business card OCR via GPT-4o Vision.
 * Accepts a base64-encoded image and returns structured contact fields.
 * Falls back to regex extraction from raw text if Vision API is unavailable.
 */

export type BusinessCardFields = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  address?: string | null;
  rawLines: string[];
};

/**
 * Extract contact fields from a business card image using GPT-4o Vision.
 */
export async function extractBusinessCardFromImage(
  imageBase64: string
): Promise<BusinessCardFields> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return emptyFields();

  try {
    // Ensure proper data URL format
    const dataUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              'You extract contact information from business card images. Return ONLY valid JSON with this schema: {"name":"string or null","email":"string or null","phone":"string or null","company":"string or null","title":"string or null","address":"string or null"}. Extract exactly what you see. If a field is not visible, set it to null.',
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the contact information from this business card:" },
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("businessCardOcr: OpenAI Vision request failed", res.status);
      return emptyFields();
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json?.choices?.[0]?.message?.content;
    if (!content) return emptyFields();

    const parsed = extractJson(content);
    return {
      name: str(parsed.name),
      email: str(parsed.email),
      phone: str(parsed.phone),
      company: str(parsed.company),
      title: str(parsed.title),
      address: str(parsed.address),
      rawLines: content.split("\n").filter(Boolean),
    };
  } catch (e) {
    console.error("businessCardOcr: extraction failed", e);
    return emptyFields();
  }
}

/**
 * Legacy: extract fields from raw OCR text (regex fallback).
 */
export function extractBusinessCardFieldsFromText(rawText: string): BusinessCardFields {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const joined = rawText;
  const emailMatch = joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = joined.match(
    /(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/
  );

  return {
    name: lines.length > 0 && !lines[0].includes("@") ? lines[0] : null,
    email: emailMatch ? emailMatch[0] : null,
    phone: phoneMatch ? phoneMatch[0].trim() : null,
    company: lines.length > 1 && lines[1] !== emailMatch?.[0] ? lines[1] : null,
    title: null,
    address: null,
    rawLines: lines,
  };
}

function emptyFields(): BusinessCardFields {
  return { name: null, email: null, phone: null, company: null, title: null, address: null, rawLines: [] };
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function extractJson(text: string): Record<string, unknown> {
  const t = text.trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return JSON.parse(t.slice(first, last + 1));
  }
  return {};
}
