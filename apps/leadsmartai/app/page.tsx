import type { Metadata } from "next";
import { redirect } from "next/navigation";
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

export const metadata: Metadata = {
  title: "LeadSmart AI — The AI Deal Engine + Coaching for Real Estate",
  description:
    "Capture, qualify, convert, and coach — every stage of the deal on real-estate-native AI. Includes the LeadSmart AI Coaching program with annual transaction targets. Pro from $49/mo, Team from $199/mo.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "LeadSmart AI — The AI Deal Engine + Coaching for Real Estate",
    description:
      "The AI deal engine + producer-development program built for real estate agents. 14-day trial, cancel anytime.",
  },
};

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
