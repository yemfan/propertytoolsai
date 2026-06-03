import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — HelmSmart",
  description: "HelmSmart's privacy policy and data handling practices.",
};

export default function PrivacyPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="border-b border-gray-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            Last updated: May 29, 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <div className="prose prose-sm max-w-none space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Introduction</h2>
            <p className="text-gray-600 leading-relaxed">
              HelmSmart ("we," "us," "our," or "Company") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and services.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Information We Collect</h2>
            <p className="text-gray-600 leading-relaxed mb-3">We collect information you provide directly:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Account information (name, email, company)</li>
              <li>Contact preferences and communication history</li>
              <li>Business information and usage data</li>
              <li>Payment information (processed securely through third parties)</li>
              <li>Customer support inquiries and feedback</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. How We Use Your Information</h2>
            <p className="text-gray-600 leading-relaxed mb-3">We use collected information to:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Provide, maintain, and improve HelmSmart services</li>
              <li>Process transactions and send related confirmations</li>
              <li>Send transactional emails and account notifications</li>
              <li>Respond to your inquiries and customer support requests</li>
              <li>Monitor and analyze service usage and trends</li>
              <li>Detect and prevent fraud or security issues</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Data Security</h2>
            <p className="text-gray-600 leading-relaxed">
              We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Third-Party Services</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              HelmSmart is built by the same team behind <Link href="https://leadsmart-ai.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700 font-medium">LeadSmart AI</Link>, and both products share similar privacy standards and infrastructure. We use third-party service providers for:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Email delivery (Resend)</li>
              <li>Authentication (Supabase)</li>
              <li>Payment processing (PCI-compliant providers)</li>
              <li>Analytics and monitoring</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. User Rights</h2>
            <p className="text-gray-600 leading-relaxed">
              Depending on your location, you may have rights to access, correct, or delete your personal information. Contact us at privacy@helmsmart.ai to exercise these rights.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Changes to This Policy</h2>
            <p className="text-gray-600 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by updating the date at the top of this policy.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Contact Us</h2>
            <p className="text-gray-600 leading-relaxed">
              If you have questions about this Privacy Policy or our privacy practices, please contact us at:
            </p>
            <p className="text-gray-600 mt-3">
              <strong>Email:</strong> privacy@helmsmart.ai<br />
              <strong>Web:</strong> <Link href="/contact" className="text-indigo-600 hover:text-indigo-700">helmsmart.ai/contact</Link>
            </p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            HelmSmart is committed to the same privacy standards as our sibling product,{" "}
            <Link href="https://leadsmart-ai.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700">
              LeadSmart AI
            </Link>
            . Both products prioritize user privacy and data security.
          </p>
        </div>
      </section>
    </div>
  );
}
