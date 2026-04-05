import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the LeadSmart AI team. We'd love to hear from you about lead management and CRM solutions.",
  keywords: ["contact", "support", "LeadSmart AI", "CRM", "lead management"],
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-4">Contact</h1>
      <p className="text-slate-600 mb-6">
        Get in touch with the LeadSmart AI team. We&apos;d love to hear from you.
      </p>
      <Link href="/" className="text-primary-600 hover:text-primary-700 font-medium">
        ← Back to Home
      </Link>
    </div>
  );
}
