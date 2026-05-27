import { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SocialComposer } from "@/components/social-composer";

export const metadata: Metadata = { title: "Social" };

export default async function SocialPage() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value ?? "";
  const supabase = await createClient();

  const [{ data: posts }, { data: org }] = await Promise.all([
    supabase
      .from("social_posts")
      .select("id, platform, content, status, scheduled_at, published_at, published_url, generated_by_ai, ai_prompt, tone, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single(),
  ]);

  return (
    <div className="flex flex-col h-full">
      <SocialComposer
        posts={(posts ?? []) as Parameters<typeof SocialComposer>[0]["posts"]}
        orgName={org?.name ?? "My Business"}
      />
    </div>
  );
}
