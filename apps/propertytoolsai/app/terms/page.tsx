import MarketingContentLayout from "@/components/layout/MarketingContentLayout";

export default function TermsPage() {
  return (
    <MarketingContentLayout
      eyebrow="Legal"
      title="Terms of Service"
      intro="Terms of use for propertytoolsai.com. Use of our tools is subject to these terms."
    >
      <p>
        By using PropertyTools AI calculators, reports, and related services, you agree to use them for lawful
        purposes only and to follow any usage limits or fair-use policies we publish.
      </p>
      <p>
        Estimates and AI-generated outputs are informational and not a substitute for professional appraisal, legal, or
        tax advice. We may update these terms; continued use after changes constitutes acceptance.
      </p>
    </MarketingContentLayout>
  );
}
