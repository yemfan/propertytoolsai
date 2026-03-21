import { createHash } from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";

export function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt, "utf8").digest("hex");
}

export async function getCachedResponse(promptHash: string): Promise<string | null> {
  const { data, error } = await supabaseServer
    .from("ai_cache")
    .select("response")
    .eq("prompt_hash", promptHash)
    .maybeSingle();

  if (error && (error as any).code !== "PGRST116") {
    console.error("[PropertyTools AI] ai_cache read error", error.message);
    return null;
  }
  const text = (data as any)?.response;
  return typeof text === "string" && text.length > 0 ? text : null;
}

export async function setCachedResponse(promptHash: string, response: string): Promise<void> {
  const { error } = await supabaseServer.from("ai_cache").upsert(
    {
      prompt_hash: promptHash,
      response,
      created_at: new Date().toISOString(),
    },
    { onConflict: "prompt_hash" }
  );

  if (error) {
    console.error("[PropertyTools AI] ai_cache write error", error.message);
  }
}
