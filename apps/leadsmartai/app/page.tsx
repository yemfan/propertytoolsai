import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerT } from "@/lib/i18n/server";
import { resolvePostAuthHomePath } from "@/lib/rolePortalServer";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
// V2 conversion-focused landing — see components/marketing/LeadSmartLandingV2.tsx.
// V1 (LeadSmartLanding.tsx) is kept on disk for revert / reference; not imported.
import LeadSmartLanding from "@/components/marketing/LeadSmartLandingV2";

/**
 * FAQ JSON-LD removed — V2 dropped the FAQ section, and Google's
 * structured-data guidelines require the visible page to mirror the
 * structured data. Restore (with a matching `<FAQ>` section in the
 * landing) if FAQ rich-snippet SEO becomes a priority again.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return {
    title: t("landing.title", { ns: "web_marketing" }),
    description: t("landing.description", { ns: "web_marketing" }),
    alternates: {
      canonical: "/",
    },
    openGraph: {
      title: t("landing.og.title", { ns: "web_marketing" }),
      description: t("landing.og.description", { ns: "web_marketing" }),
    },
  };
}

export default async function HomePage() {
  try {
    const supabase = supabaseServerClient();
    const dashboardPath = await resolvePostAuthHomePath(supabase);
    if (dashboardPath) redirect(dashboardPath);
  } catch (e) {
    // redirect() throws — rethrow it; swallow everything else so marketing page still renders.
    if (e && typeof e === "object" && "digest" in e) throw e;
  }

  return <LeadSmartLanding />;
}
