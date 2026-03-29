/**
 * Placeholder / integration hook for business-card OCR.
 * Swap this for Google Vision, AWS Textract, or on-device ML — keep the same return shape.
 */
export function extractBusinessCardFieldsFromText(rawText: string): {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  rawLines: string[];
} {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const joined = rawText;
  const emailMatch = joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = joined.match(
    /(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/
  );

  let name: string | null = null;
  if (lines.length > 0 && !lines[0].includes("@")) {
    name = lines[0];
  }

  return {
    name,
    email: emailMatch ? emailMatch[0] : null,
    phone: phoneMatch ? phoneMatch[0].trim() : null,
    company: lines.length > 1 && lines[1] !== emailMatch?.[0] ? lines[1] : null,
    title: null,
    rawLines: lines,
  };
}
