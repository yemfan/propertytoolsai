import MarketingContentLayout from "@/components/layout/MarketingContentLayout";

export default function PrivacyPage() {
  return (
    <MarketingContentLayout
      eyebrow="Legal"
      title="Privacy Policy"
      intro="Your privacy matters. Here’s how we think about data for PropertyTools AI."
    >
      <p>
        We collect information you provide (such as email or property details when you use a tool) and technical data
        needed to run the service securely (such as logs and analytics).
      </p>
      <p>
        We use data to deliver features, improve our products, and communicate with you when you opt in. We do not sell
        your personal information. For full details, refer to the complete policy your team maintains for production.
      </p>
    </MarketingContentLayout>
  );
}
