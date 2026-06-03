"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAccountsForEntityType } from "@/lib/data/chart-of-accounts-seed";

export type OrgState = { error: string } | null;

/** Slugify a business name: lowercase, hyphens only. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const ORG_COOKIE = "helmsmart-org-id";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365, // 1 year
  path: "/",
} as const;

/**
 * Create a new organization for the authenticated user.
 * Seeds the chart of accounts based on entity type.
 * Sets the helmsmart-org-id cookie so middleware can route without a DB call.
 */
export async function createOrg(
  _: OrgState,
  formData: FormData
): Promise<OrgState> {
  const name = (formData.get("name") as string)?.trim();
  const entityType = formData.get("entity_type") as string;

  if (!name) return { error: "Business name is required." };
  if (!entityType) return { error: "Please select a business structure." };

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  // If user already has an org, just set the cookie and redirect
  const { data: existing } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const cookieStore = await cookies();
    cookieStore.set(ORG_COOKIE, existing.organization_id, COOKIE_OPTS);
    redirect("/books");
  }

  // Create the organization (service role to bypass RLS on insert)
  const service = createServiceClient();

  const { data: org, error: orgError } = await service
    .from("organizations")
    .insert({
      name,
      slug: `${slugify(name)}-${Date.now()}`,
      entity_type: entityType,
    })
    .select("id")
    .single();

  if (orgError || !org) {
    console.error("createOrg error:", orgError);
    return { error: "Failed to create organization. Please try again." };
  }

  // Add user as owner
  const { error: memberError } = await service
    .from("organization_members")
    .insert({
      organization_id: org.id,
      user_id: user.id,
      role: "owner",
    });

  if (memberError) {
    console.error("createOrg membership error:", memberError);
    return { error: "Organization created but membership failed. Contact support." };
  }

  // Seed chart of accounts
  const accounts = getAccountsForEntityType(entityType);
  const { error: coaError } = await service.from("chart_of_accounts").insert(
    accounts.map((a) => ({ organization_id: org.id, ...a }))
  );

  if (coaError) {
    // Non-fatal — org + membership exist, CoA can be re-seeded
    console.error("CoA seed error:", coaError);
  }

  // Set org cookie for middleware routing
  const cookieStore = await cookies();
  cookieStore.set(ORG_COOKIE, org.id, COOKIE_OPTS);

  redirect("/books");
}
