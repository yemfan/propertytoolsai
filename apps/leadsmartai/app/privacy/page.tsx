import type { Metadata } from "next";
import Link from "next/link";

/**
 * [REQUIRES LEGAL REVIEW]
 *
 * Replaces the pre-launch placeholder flagged in TOM validation report CR-001.
 * Scaffold covers every topic a privacy policy for an AI lead-automation
 * product must address. None of it is legal advice.
 *
 * Before accepting any paying customer, replace with counsel-reviewed copy
 * or a generator-produced policy (Termly, Iubenda, TermsFeed) tailored to:
 *   - SMS via Twilio + TCPA consent
 *   - Email via SendGrid / Resend + CAN-SPAM
 *   - AI processing (OpenAI + Anthropic) as sub-processors
 *   - Lead + contact data under CCPA/CPRA and GDPR
 *   - Payment processing via Stripe
 *
 * Any section still marked "[REQUIRES LEGAL REVIEW]" is a gap to close.
 */

const LAST_UPDATED = "April 24, 2026";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How LeadSmart AI collects, uses, shares, and protects your personal and business information, including SMS, email, and AI processing disclosures.",
  alternates: { canonical: "/privacy" },
  keywords: ["privacy policy", "data protection", "GDPR", "CCPA", "TCPA", "SMS consent"],
};

const SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "introduction",
    title: "1. Introduction",
    body: (
      <>
        <p>
          MAXY Investment Inc., a Texas corporation, doing business as LeadSmart AI
          (&ldquo;LeadSmart,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
          &ldquo;our&rdquo;) operates the website leadsmart-ai.com and provides AI-assisted
          lead management, CRM, SMS follow-up, email automation, and related services (the
          &ldquo;Service&rdquo;). This Privacy Policy explains what information we collect,
          how we use and share it, and the choices you have.
        </p>
        <p>
          By using the Service you agree to the practices described here. If you do not
          agree, please do not use the Service.
        </p>
      </>
    ),
  },
  {
    id: "information-we-collect",
    title: "2. Information we collect",
    body: (
      <>
        <p>We collect information in three buckets:</p>
        <ul>
          <li>
            <strong>Information you give us directly</strong> — account details (name,
            email, phone, brokerage, role), billing information processed through our
            payment processor, content you create in the Service (lead records, contacts,
            messages, notes, preferences), and support communications.
          </li>
          <li>
            <strong>Information about how you use the Service</strong> — pages viewed,
            features used, device and browser identifiers, IP address, approximate location
            derived from IP, session duration, referrer, and crash or error diagnostics.
          </li>
          <li>
            <strong>Information from integrations you connect</strong> — lead sources such
            as Zillow, Realtor.com, Follow Up Boss, kvCORE, Sierra Interactive, Facebook
            Lead Ads, Google, and any IDX site you link. If you connect Gmail, we also
            receive the content of email messages sent to or from CRM contacts — see
            section 5 for the specific Gmail handling rules. We receive only what each
            integration&rsquo;s OAuth scope permits.
          </li>
        </ul>
        <p>
          [REQUIRES LEGAL REVIEW] Enumerate the specific categories of personal information
          collected for CCPA/CPRA purposes (identifiers, commercial information, internet
          activity, geolocation, professional information, inferences).
        </p>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "3. How we use information",
    body: (
      <>
        <p>We use the information described above to:</p>
        <ul>
          <li>Operate, maintain, and improve the Service.</li>
          <li>
            Send automated SMS and email on your behalf to leads and contacts you manage
            (only where consent has been captured — see section 6, &ldquo;SMS and email
            compliance&rdquo;).
          </li>
          <li>Personalize the product experience and generate AI-assisted recommendations.</li>
          <li>Provide customer support and respond to inquiries.</li>
          <li>
            Detect and prevent fraud, abuse, and violations of our{" "}
            <Link href="/terms" className="text-[#0072ce] hover:underline">
              Terms of Service
            </Link>
            .
          </li>
          <li>Comply with legal obligations and enforce our rights.</li>
          <li>
            Send you product updates, security notices, and (with your consent) marketing
            communications.
          </li>
        </ul>
        <p>
          [REQUIRES LEGAL REVIEW] Confirm whether aggregated/de-identified data is used for
          general model improvement; if so, disclose here with an opt-out.
        </p>
      </>
    ),
  },
  {
    id: "ai-processing",
    title: "4. AI processing",
    body: (
      <>
        <p>
          LeadSmart uses third-party AI providers — currently OpenAI and Anthropic — to
          generate messages, summarize calls, and rank leads. When the Service sends data
          to these providers:
        </p>
        <ul>
          <li>Only the content needed for the specific task is transmitted.</li>
          <li>
            Providers act as data processors under agreements that prohibit using the data
            to train their models for other customers.
          </li>
          <li>
            Generated output is treated as your data and subject to the same protections as
            the input.
          </li>
        </ul>
        <p>
          [REQUIRES LEGAL REVIEW] Confirm sub-processor DPA terms, list each AI provider
          and its purpose, and state whether content is retained by the provider after
          processing.
        </p>
      </>
    ),
  },
  {
    id: "google-user-data",
    title: "5. Google user data — Gmail sync",
    body: (
      <>
        <p>
          Agents may optionally connect their Google account to enable Gmail sync.
          When connected, LeadSmart requests the <code>gmail.readonly</code> OAuth
          scope and reads new messages on a periodic schedule to automatically log
          conversations with CRM contacts. Connecting is explicit and reversible —
          the feature stays off until you click &ldquo;Connect Gmail&rdquo; in
          Settings.
        </p>

        <p className="font-semibold text-slate-900">What we access</p>
        <ul>
          <li>
            The <code>gmail.readonly</code> scope (read-only access to Gmail
            messages and metadata).
          </li>
          <li>
            Your Gmail address (<code>userinfo.email</code>), used only to label
            the connected account in the LeadSmart UI.
          </li>
        </ul>

        <p className="font-semibold text-slate-900">How we use Gmail data</p>
        <ul>
          <li>
            For each message we read, we extract the <strong>From</strong>,{" "}
            <strong>To</strong>, <strong>Cc</strong>, <strong>Subject</strong>,
            and plain-text <strong>body</strong>.
          </li>
          <li>
            We check whether any counterparty&rsquo;s email matches a contact
            in <em>your</em> CRM.
          </li>
          <li>
            <strong>If matched:</strong> we store a copy of the message in
            LeadSmart so it appears on the contact&rsquo;s timeline.
          </li>
          <li>
            <strong>If not matched:</strong> we discard the message in memory.
            We do not store it, index it, or use it for any other purpose.
          </li>
        </ul>

        <p className="font-semibold text-slate-900">How we don&apos;t use Gmail data</p>
        <ul>
          <li>
            We do <strong>not</strong> use Gmail data to serve advertising to
            any user.
          </li>
          <li>
            We do <strong>not</strong> use Gmail data to train, fine-tune, or
            otherwise develop generalized machine-learning models, including
            large language models.
          </li>
          <li>
            We do <strong>not</strong> sell, license, or transfer Gmail data to
            any third party, except the sub-processors necessary to operate
            the Service (database hosting, infrastructure) and only under
            contractual obligations that mirror these restrictions.
          </li>
          <li>
            Humans at LeadSmart do not read your Gmail content except when (i)
            you give explicit written permission for specific messages, (ii)
            it is necessary for security or to prevent abuse, (iii) it is
            required for compliance with applicable law, or (iv) the content
            is first aggregated and anonymized in a way that cannot be used to
            identify you or your contacts.
          </li>
        </ul>

        <p className="font-semibold text-slate-900">Limited use disclosure</p>
        <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
          LeadSmart AI&apos;s use and transfer to any other app of information
          received from Google APIs will adhere to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            className="text-[#0072ce] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy#limited-use"
            className="text-[#0072ce] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Limited Use
          </a>{" "}
          requirements.
        </p>

        <p className="font-semibold text-slate-900">Retention and deletion</p>
        <ul>
          <li>
            Matched messages are retained in your LeadSmart CRM until you
            delete them, delete the associated contact, or delete your
            account. When your account is deleted, messages are removed or
            anonymized within 90 days, aligned with section 11 below.
          </li>
          <li>
            <strong>Disconnecting Gmail</strong> from Settings revokes our
            access token and stops all future sync immediately. Messages
            already logged to your CRM remain until you delete them — they
            are treated as part of your CRM history, not as live Google data.
          </li>
        </ul>

        <p className="font-semibold text-slate-900">Your controls</p>
        <ul>
          <li>
            <strong>Disconnect inside LeadSmart</strong> — Settings &rarr;
            Channels &rarr; Gmail sync &rarr; Disconnect.
          </li>
          <li>
            <strong>Revoke via Google</strong> — visit{" "}
            <a
              href="https://myaccount.google.com/permissions"
              className="text-[#0072ce] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              myaccount.google.com/permissions
            </a>{" "}
            and remove LeadSmart AI. Any in-flight sync is terminated at the
            Google side.
          </li>
          <li>
            <strong>Delete stored messages</strong> — remove individual
            messages from a contact&apos;s timeline, or email{" "}
            <a
              href="mailto:contact@leadsmart-ai.com"
              className="text-[#0072ce] hover:underline"
            >
              contact@leadsmart-ai.com
            </a>{" "}
            to purge all Gmail-synced content from your account.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "sharing",
    title: "6. How we share information",
    body: (
      <>
        <p>We share information only with:</p>
        <ul>
          <li>
            <strong>Service providers</strong> that help us operate the Service — hosting
            (Vercel, Supabase), SMS delivery (Twilio), email delivery (SendGrid / Resend),
            payments (Stripe), AI inference (OpenAI, Anthropic), analytics, and customer
            support tools.
          </li>
          <li>
            <strong>Your leads and contacts</strong> — messages you or LeadSmart send on
            your behalf disclose your identity to those recipients.
          </li>
          <li>
            <strong>Legal and safety</strong> — when required by law, subpoena, court
            order, or to protect the rights, property, or safety of LeadSmart, our users,
            or the public.
          </li>
          <li>
            <strong>Business transfers</strong> — in connection with a merger, acquisition,
            or sale of assets.
          </li>
        </ul>
        <p>
          We do <strong>not</strong> sell personal information in exchange for monetary
          consideration. [REQUIRES LEGAL REVIEW] Confirm with counsel whether any data
          sharing constitutes a &ldquo;sale&rdquo; or &ldquo;share&rdquo; under CCPA/CPRA
          definitions, which are broader than intuitive.
        </p>
      </>
    ),
  },
  {
    id: "sms-email-compliance",
    title: "7. SMS and email compliance",
    body: (
      <>
        <p>
          LeadSmart sends SMS and email on your behalf only when consent has been
          established. By using the Service, you represent and warrant that:
        </p>
        <ul>
          <li>
            You have obtained prior express written consent (as required by the Telephone
            Consumer Protection Act, 47 U.S.C. § 227, and FCC rules) from every recipient
            before a marketing SMS is sent on your behalf.
          </li>
          <li>
            For non-marketing SMS (informational / transactional), you have a legitimate
            business relationship with the recipient.
          </li>
          <li>
            Every marketing email complies with the CAN-SPAM Act, including an unsubscribe
            link and accurate sender identification.
          </li>
          <li>
            You will honor STOP / UNSUBSCRIBE / HELP requests immediately — LeadSmart
            automatically suppresses these numbers and addresses on your behalf, but
            compliance is ultimately your responsibility.
          </li>
        </ul>
        <p>
          For 10DLC sender / caller allocation: LeadSmart maintains a registered
          10DLC brand and campaign with The Campaign Registry (TCR) and operates
          the SMS sending infrastructure as the messaging vendor. You remain the
          &ldquo;caller&rdquo; under the TCPA and the &ldquo;sender&rdquo; under
          the CAN-SPAM Act, which means consent capture and message content are
          your responsibility. Section 6 of the{" "}
          <Link href="/terms#sms-email-compliance" className="text-[#0072ce] hover:underline">
            Terms of Service
          </Link>{" "}
          spells this out in detail, including the option to bring your own
          10DLC brand for enterprise use cases.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "8. Cookies and tracking",
    body: (
      <>
        <p>
          We use cookies and similar technologies to keep you signed in, remember
          preferences, measure usage, and improve the Service. You can control cookies
          through your browser settings. Blocking essential cookies will break functions
          like staying signed in.
        </p>
        <p>
          [REQUIRES LEGAL REVIEW] Add explicit category breakdown (strictly necessary,
          functional, analytics, advertising) and wire a consent banner for EU/California
          visitors.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    title: "9. Your rights",
    body: (
      <>
        <p>Depending on where you live, you may have the right to:</p>
        <ul>
          <li>Access the personal information we hold about you.</li>
          <li>Correct inaccurate information.</li>
          <li>Delete your account and associated personal information.</li>
          <li>Export your data in a portable format.</li>
          <li>Object to or restrict certain processing.</li>
          <li>Withdraw consent to marketing communications.</li>
          <li>
            Opt out of any &ldquo;sale&rdquo; or &ldquo;sharing&rdquo; of personal
            information as defined under CCPA/CPRA (even though we do not believe we
            engage in either).
          </li>
        </ul>
        <p>
          To exercise any of these rights, email{" "}
          <a
            href="mailto:contact@leadsmart-ai.com"
            className="text-[#0072ce] hover:underline"
          >
            contact@leadsmart-ai.com
          </a>
          . We will respond within the timeframes required by applicable law.
        </p>
        <p>
          [REQUIRES LEGAL REVIEW] Add California-specific &ldquo;Do Not Sell or Share My
          Personal Information&rdquo; link if applicable, plus EU Data Protection
          Authority contact paths.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "10. Retention",
    body: (
      <>
        <p>
          We keep personal information for as long as your account is active and for a
          reasonable period afterward to handle support issues, enforce agreements, and
          comply with law. When your account is deleted we remove or anonymize personal
          information within 90 days, except where retention is required for legal,
          accounting, or fraud-prevention purposes.
        </p>
        <p>
          [REQUIRES LEGAL REVIEW] Confirm retention windows per data category and align
          with counsel on minimum legal retention (financial records, TCPA opt-in proof,
          etc.).
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "11. Security",
    body: (
      <>
        <p>
          We apply industry-standard administrative, technical, and physical safeguards,
          including encryption in transit (TLS) and at rest, access controls, audit
          logging, and regular security reviews. No method of transmission or storage is
          100% secure, but we work to protect your information and promptly investigate
          and address incidents.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "12. Children",
    body: (
      <>
        <p>
          The Service is not directed to children under 16. We do not knowingly collect
          personal information from children. If you believe we have inadvertently
          collected information from a child, contact us so we can delete it.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "13. Changes to this policy",
    body: (
      <>
        <p>
          We may update this Privacy Policy from time to time. Material changes will be
          notified via email or a prominent notice in the Service at least 30 days before
          they take effect. The &ldquo;last updated&rdquo; date at the top of this page
          always reflects the current version.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "14. Contact",
    body: (
      <>
        <p>
          Questions about this Privacy Policy can be directed to{" "}
          <a
            href="mailto:contact@leadsmart-ai.com"
            className="text-[#0072ce] hover:underline"
          >
            contact@leadsmart-ai.com
          </a>
          .
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        <strong>Notice:</strong> This page is the product&apos;s pre-launch scaffold. It
        covers the topics a real privacy policy must address but is{" "}
        <strong>not legal advice</strong> and must be replaced with counsel-reviewed or
        generator-produced copy before paid launch.
      </div>

      <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: {LAST_UPDATED}</p>

      <nav
        aria-label="Table of contents"
        className="mb-10 rounded-lg border border-slate-200 bg-slate-50 p-4"
      >
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
          Contents
        </div>
        <ol className="list-decimal list-inside space-y-1 text-sm text-slate-700">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-[#0072ce] hover:underline">
                {s.title.replace(/^\d+\.\s*/, "")}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="space-y-8 text-slate-700">
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-20">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">{s.title}</h2>
            <div className="space-y-3 leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ul]:mt-3">
              {s.body}
            </div>
          </section>
        ))}
      </article>

      <div className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500">
        See also our{" "}
        <Link href="/terms" className="text-[#0072ce] hover:underline">
          Terms of Service
        </Link>
        .{" "}
        <Link href="/" className="ml-2 text-[#0072ce] hover:underline">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
