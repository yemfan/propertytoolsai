import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of service for LeadSmart AI. Review the terms governing use of our lead management, CRM, and automation tools.",
  keywords: ["terms", "terms of service", "agreement", "legal", "conditions"],
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-4">Terms of Service</h1>
      <p className="text-slate-600 mb-6">
        Terms of use for leadsmart-ai.com. Use of our tools is subject to these terms.
      </p>
      <Link href="/" className="text-primary-600 hover:text-primary-700 font-medium">
        ← Back to Home
      </Link>
    </div>
  );
}
