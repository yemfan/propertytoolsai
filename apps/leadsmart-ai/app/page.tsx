import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LeadSmartLanding from "@/components/marketing/LeadSmartLanding";
import { resolvePostAuthHomePath } from "@/lib/rolePortalServer";
import { supabaseServerClient } from "@/lib/supabaseServerClient";

export const metadata: Metadata = {
  title: "LeadSmart AI — The AI Deal Engine for Real Estate",
  description:
    "We don’t just generate leads — we turn them into closed deals, automatically. Capture, qualify, and convert buyers and sellers with AI. Focus on closing, not chasing.",
  openGraph: {
    title: "LeadSmart AI — The AI Deal Engine for Real Estate",
    description:
      "High-intent buyers and sellers, captured and converted with AI. No setup required — works in minutes.",
  },
};

export default async function HomePage() {
  const supabase = supabaseServerClient();
  const path = await resolvePostAuthHomePath(supabase);
  if (path === null) {
    return <LeadSmartLanding />;
  }
  redirect(path);
}
