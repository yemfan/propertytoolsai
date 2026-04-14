import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolvePostAuthHomePath } from "@/lib/rolePortalServer";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import LeadSmartLanding from "@/components/marketing/LeadSmartLanding";

export const metadata: Metadata = {
  title: "LeadSmart AI — The AI Deal Engine for Real Estate",
  description:
    "We don’t just generate leads — we turn them into closed deals, automatically. Capture, qualify, and convert buyers and sellers with AI. Focus on closing, not chasing.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "LeadSmart AI — The AI Deal Engine for Real Estate",
    description:
      "High-intent buyers and sellers, captured and converted with AI. No setup required — works in minutes.",
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
