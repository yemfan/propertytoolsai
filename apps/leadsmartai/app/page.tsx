import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolvePostAuthHomePath } from "@/lib/rolePortalServer";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import LeadSmartLanding from "@/components/marketing/LeadSmartLanding";

/**
 * Homepage FAQ — must stay in sync with the FAQ section rendered by
 * LeadSmartLanding.tsx. Emitting this as FAQPage JSON-LD (per TOM report
 * recommendation) unlocks Google rich-result snippets for "how does
 * LeadSmart work" / "Will leads know they're talking to AI" queries.
 */
const HOMEPAGE_FAQ = [
  {
    q: "How does the AI follow-up actually work?",
    a: "When a new lead comes in from any source — your website, Zillow, Facebook, etc. — LeadSmart AI sends a personalized text and email within 60 seconds. The message is tailored to where they came from and what they were looking at. If they reply, AI continues the conversation and qualifies them before handing off to you.",
  },
  {
    q: "Does it integrate with my current CRM or website?",
    a: "Yes. LeadSmart AI connects with major real estate CRMs (Follow Up Boss, kvCORE, Sierra Interactive, and more) via Zapier or native integrations. Your website lead forms, Zillow, and Facebook Lead Ads all flow in automatically. Setup typically takes under 15 minutes.",
  },
  {
    q: "What happens after the free trial?",
    a: "You choose a plan — or you don't. There's no auto-charge after the trial ends. If you upgrade to Pro, your leads, sequences, and pipeline history carry over seamlessly. If you stay on the Free plan, you keep up to 25 leads/month with core features.",
  },
  {
    q: "Will leads know they're talking to AI?",
    a: "LeadSmart AI is designed to be transparent. Messages are sent in your name and from your number. When a lead is ready to connect, you're looped in immediately. You can customize exactly how much AI handles before you take over.",
  },
  {
    q: "How is this different from a standard CRM?",
    a: "Most CRMs track what happened. LeadSmart AI acts on it. Instead of logging a lead and setting a manual reminder, our AI sends the first message, qualifies the lead, books a call if they're ready, and only escalates to you when there's real buying intent — saving you hours every week.",
  },
] as const;

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

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: HOMEPAGE_FAQ.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }),
        }}
      />
      <LeadSmartLanding />
    </>
  );
}
