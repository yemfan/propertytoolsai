import { supabaseAdmin } from "@/lib/supabase/admin";

export type TemplateSummary = {
  total: number;
  autosend: number;
  review: number;
  off: number;
  /** Top N templates for the summary card (most common status first). */
  rows: SummaryRow[];
  /** True when the templates DB hasn't been seeded — fall back to static messaging. */
  fallback: boolean;
  /** English+Chinese bilingual coverage fraction, 0..1. Used for the bilingual note. */
  bilingualCoverageFraction: number;
};

export type SummaryRow = {
  id: string;
  name: string;
  category: "sphere" | "lead_response" | "lifecycle" | string;
  channel: "sms" | "email" | string;
  status: "autosend" | "review" | "off";
  languages: string[]; // ["EN", "中文"]
};

const EMPTY: TemplateSummary = {
  total: 0,
  autosend: 0,
  review: 0,
  off: 0,
  rows: [],
  fallback: true,
  bilingualCoverageFraction: 0,
};

/**
 * Summarize templates and per-agent overrides for the Messages > Templates card.
 * Returns a `fallback` summary when the templates table is missing / empty, so
 * the settings UI stays useful before the library has been seeded.
 */
export async function getTemplateSummaryForAgent(
  agentId: string | null | undefined,
  limit = 8,
): Promise<TemplateSummary> {
  if (!agentId) return { ...EMPTY };

  try {
    const { data: tplRows, error: tplErr } = await supabaseAdmin
      .from("templates")
      .select("id, name, category, channel, language, variant_of, default_status");
    if (tplErr || !tplRows) return { ...EMPTY };
    if (tplRows.length === 0) return { ...EMPTY, fallback: true };

    const { data: ovRows } = await supabaseAdmin
      .from("template_overrides")
      .select("template_id, status")
      .eq("agent_id", agentId as never);
    const overrides = new Map<string, "autosend" | "review" | "off">();
    for (const row of ovRows ?? []) {
      const r = row as { template_id?: string; status?: string };
      if (r.template_id && (r.status === "autosend" || r.status === "review" || r.status === "off")) {
        overrides.set(r.template_id, r.status);
      }
    }

    const langsByRoot = new Map<string, Set<string>>();
    for (const row of tplRows) {
      const r = row as {
        id: string;
        variant_of?: string | null;
        language?: string | null;
      };
      const root = r.variant_of ?? r.id;
      if (!langsByRoot.has(root)) langsByRoot.set(root, new Set<string>());
      const lang = (r.language ?? "en").toLowerCase();
      if (lang.startsWith("zh")) langsByRoot.get(root)!.add("中文");
      else langsByRoot.get(root)!.add("EN");
    }

    const parents = (tplRows as Array<Record<string, unknown>>).filter(
      (r) => !r.variant_of,
    );

    let autosend = 0;
    let review = 0;
    let off = 0;
    let bilingualCount = 0;

    const rows: SummaryRow[] = parents.map((r) => {
      const id = String(r.id);
      const status =
        overrides.get(id) ??
        ((r.default_status as "autosend" | "review" | "off" | null) ?? "review");
      if (status === "autosend") autosend++;
      else if (status === "review") review++;
      else off++;
      const langs = Array.from(langsByRoot.get(id) ?? new Set<string>());
      const hasEn = langs.includes("EN");
      const hasZh = langs.includes("中文");
      if (hasEn && hasZh) bilingualCount++;
      return {
        id,
        name: String(r.name ?? id),
        category: String(r.category ?? ""),
        channel: String(r.channel ?? ""),
        status,
        languages: langs.length ? langs : ["EN"],
      };
    });

    const statusRank: Record<SummaryRow["status"], number> = {
      autosend: 0,
      review: 1,
      off: 2,
    };
    rows.sort((a, b) => statusRank[a.status] - statusRank[b.status]);

    return {
      total: parents.length,
      autosend,
      review,
      off,
      rows: rows.slice(0, limit),
      fallback: false,
      bilingualCoverageFraction: parents.length ? bilingualCount / parents.length : 0,
    };
  } catch {
    return { ...EMPTY };
  }
}
