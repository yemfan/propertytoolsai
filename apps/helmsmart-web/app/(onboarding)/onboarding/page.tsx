import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/onboarding-form";

/**
 * Onboarding page — server component that gate-checks auth,
 * then renders the client OnboardingForm.
 *
 * If the user already has an org (cookie set), skip straight to /books.
 * Middleware already blocks unauthenticated access, but we double-check here
 * to be safe and to set the cookie if it's somehow missing.
 */
export default async function OnboardingPage() {
  // Fast-path: cookie already set means org exists
  const cookieStore = await cookies();
  const orgCookie = cookieStore.get("helmsmart-org-id")?.value;
  if (orgCookie) {
    redirect("/books");
  }

  // Verify session (middleware already ensures user is logged in, but belt+suspenders)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check DB in case cookie was cleared but membership exists
  const { data: existing } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Restore cookie and redirect
    // (cookie can't be set in a server component — do it via a small redirect
    //  to an API route that re-establishes the cookie)
    redirect(`/api/auth/restore-org?org_id=${existing.organization_id}`);
  }

  return <OnboardingForm />;
}
