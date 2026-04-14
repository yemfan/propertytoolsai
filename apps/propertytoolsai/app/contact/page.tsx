import type { Metadata } from "next";
import MarketingContentLayout from "@/components/layout/MarketingContentLayout";
import JsonLd from "@/components/JsonLd";

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
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ContactPoint",
          contactType: "Customer Service",
          url: "https://propertytoolsai.com/contact",
          name: "PropertyTools AI Contact",
          availableLanguage: ["en"],
        }}
      />
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
    </>
  );
}
