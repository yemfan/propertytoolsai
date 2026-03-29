import type { SnippetBlock } from "./types";

export function normalizeSnippetBlocks(raw: unknown): SnippetBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: SnippetBlock[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (o.type === "paragraph" && typeof o.text === "string") {
      out.push({ type: "paragraph", text: o.text.trim() });
    } else if (o.type === "bullets" && Array.isArray(o.items)) {
      out.push({
        type: "bullets",
        items: o.items.map((s) => String(s).trim()).filter(Boolean),
      });
    } else if (
      o.type === "definition" &&
      typeof o.term === "string" &&
      typeof o.definition === "string"
    ) {
      out.push({
        type: "definition",
        term: o.term.trim(),
        definition: o.definition.trim(),
      });
    }
  }
  return out.slice(0, 12);
}

/**
 * Renders featured-snippet style HTML hints for editors (definition + bullets + short answer).
 */
export function snippetBlocksToPlainText(blocks: SnippetBlock[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.type === "paragraph") parts.push(b.text);
    if (b.type === "bullets") parts.push(b.items.map((x) => `• ${x}`).join("\n"));
    if (b.type === "definition") parts.push(`${b.term}: ${b.definition}`);
  }
  return parts.join("\n\n");
}
