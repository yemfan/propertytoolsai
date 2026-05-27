"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type Platform = "x" | "linkedin" | "facebook" | "instagram";
type Tone = "professional" | "casual" | "witty" | "promotional" | "educational";

const CHAR_LIMITS: Record<Platform, number> = {
  x: 280,
  linkedin: 3000,
  facebook: 63206,
  instagram: 2200,
};

const TONE_DESC: Record<Tone, string> = {
  professional: "formal and authoritative",
  casual: "friendly and conversational",
  witty: "clever, light-hearted with mild humour",
  promotional: "persuasive and action-oriented with a clear CTA",
  educational: "informative and helpful, teaches the reader something",
};

// ─── Generate post with AI ────────────────────────────────────────────────────

export async function generateSocialPost(
  platform: Platform,
  tone: Tone,
  topic: string,
  orgName: string
): Promise<string> {
  const limit = CHAR_LIMITS[platform];
  const platformLabel = platform === "x" ? "X (Twitter)" : platform.charAt(0).toUpperCase() + platform.slice(1);

  const prompt = `Write a ${platformLabel} post for "${orgName}" about: ${topic}

Tone: ${TONE_DESC[tone]}
Character limit: ${limit} characters (MUST stay under this limit)
Platform: ${platformLabel}

Rules:
- No hashtag spam — 1-3 relevant hashtags max for Instagram/LinkedIn, 0-2 for X, none for Facebook
- No emojis unless the tone warrants it
- Write the post text ONLY — no explanation, no quotation marks around it
- Stay under the character limit
- Make it feel authentic, not corporate
${platform === "instagram" ? "- Instagram works best with a short punchy opening line" : ""}
${platform === "linkedin" ? "- LinkedIn posts get more reach with a hook in the first line and line breaks" : ""}
${platform === "x" ? "- X posts should be punchy and direct — get to the point immediately" : ""}`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (response.content[0] as { type: string; text: string }).text ?? "";
  // Truncate to platform limit
  return text.slice(0, limit);
}

// ─── Create draft ─────────────────────────────────────────────────────────────

export async function createSocialPost(data: {
  platform: Platform;
  content: string;
  tone: Tone;
  scheduledAt?: string | null;
  aiPrompt?: string | null;
  generatedByAi: boolean;
}) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value;
  if (!orgId) throw new Error("No org");

  const supabase = await createClient();

  await supabase.from("social_posts").insert({
    organization_id: orgId,
    platform: data.platform,
    content: data.content,
    tone: data.tone,
    status: data.scheduledAt ? "scheduled" : "draft",
    scheduled_at: data.scheduledAt ?? null,
    generated_by_ai: data.generatedByAi,
    ai_prompt: data.aiPrompt ?? null,
  });

  revalidatePath("/social");
}

// ─── Update post ──────────────────────────────────────────────────────────────

export async function updateSocialPost(postId: string, data: {
  content?: string;
  status?: "draft" | "scheduled" | "published" | "failed";
  scheduledAt?: string | null;
  publishedUrl?: string | null;
}) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value;
  if (!orgId) throw new Error("No org");

  const supabase = await createClient();
  await supabase.from("social_posts").update({
    ...data.content !== undefined    ? { content: data.content } : {},
    ...data.status !== undefined     ? { status: data.status }   : {},
    ...data.scheduledAt !== undefined ? { scheduled_at: data.scheduledAt } : {},
    ...data.publishedUrl !== undefined ? { published_url: data.publishedUrl, published_at: new Date().toISOString() } : {},
    updated_at: new Date().toISOString(),
  }).eq("id", postId).eq("organization_id", orgId);

  revalidatePath("/social");
}

// ─── Delete post ──────────────────────────────────────────────────────────────

export async function deleteSocialPost(postId: string) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value;
  if (!orgId) throw new Error("No org");

  const supabase = await createClient();
  await supabase.from("social_posts").delete().eq("id", postId).eq("organization_id", orgId);
  revalidatePath("/social");
}

// ─── Save voice agent settings ────────────────────────────────────────────────

export async function saveVoiceSettings(data: {
  enabled: boolean;
  greeting: string;
  prompt: string;
}) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value;
  if (!orgId) throw new Error("No org");

  const supabase = await createClient();
  await supabase.from("organizations").update({
    voice_agent_enabled: data.enabled,
    voice_agent_greeting: data.greeting,
    voice_agent_prompt: data.prompt,
  }).eq("id", orgId);

  revalidatePath("/voice");
}
