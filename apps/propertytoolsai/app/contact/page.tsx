import type { Metadata } from "next";
import MarketingContentLayout from "@/components/layout/MarketingContentLayout";

export const metadata: Metadata = {
  title: "Contact Us | PropertyTools AI",
  description:
    "Get in touch with the PropertyTools AI team for support, partnerships, or press inquiries.",
  alternates: {
    canonical: "/contact",
  },
};

export default function ContactPage() {
  return (
    <MarketingContentLayout
      eyebrow="Contact"
      title="Get in touch"
      intro="We’d love to hear from buyers, sellers, agents, and partners."
    >
      <p>
        For support, partnerships, or press inquiries, use the contact path linked from your account or campaign
        materials. We aim to respond within one business day.
      </p>
    </MarketingContentLayout>
  );
}
