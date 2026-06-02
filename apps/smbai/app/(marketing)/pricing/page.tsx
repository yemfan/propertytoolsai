import { Check } from "lucide-react";

const tiers = [
  {
    name: "Starter",
    price: "$29",
    description: "Perfect for solo operators",
    featured: false,
    cta: "Start free trial",
    ctaHref: "/signup",
    features: [
      "Smart Inbox",
      "Basic Invoicing",
      "Calendar Sync",
      "Client CRM",
      "1 user",
    ],
  },
  {
    name: "Growth",
    price: "$79",
    description: "For growing small businesses",
    featured: true,
    cta: "Start free trial",
    ctaHref: "/signup",
    features: [
      "Everything in Starter",
      "AI Voice Receptionist",
      "HelmSmart AI Assistant",
      "Missed-call text-back & Auto Pilot",
      "Outbound & appointment-reminder calls",
      "Bookkeeping & expenses",
      "AI Daily Briefing",
      "3 users",
      "Priority support",
    ],
  },
  {
    name: "Pro",
    price: "$199",
    description: "For established businesses",
    featured: false,
    cta: "Contact sales",
    ctaHref: "/contact",
    features: [
      "Everything in Growth",
      "Multiple locations",
      "Custom AI prompt",
      "Advanced reports",
      "API access",
      "Unlimited users",
      "Dedicated support",
    ],
  },
];

const faqs = [
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. HelmSmart has no long-term contracts. You can cancel your subscription at any time from your account settings and you will not be charged again.",
  },
  {
    question: "What happens after the trial?",
    answer:
      "When your 14-day free trial ends, we will ask you to add a payment method to continue. You will never be charged automatically during the trial period.",
  },
  {
    question: "Is the voice AI really available 24/7?",
    answer:
      "Yes. The AI Voice Receptionist is powered by Retell AI and answers calls around the clock — nights, weekends, and holidays — so you never miss a customer. It also cuts the cost of after-hours answering services, replacing expensive on-call staff or third-party call centers.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "We offer a 30-day money-back guarantee on all paid plans. If you are not satisfied for any reason, contact us within 30 days of your first charge and we will issue a full refund.",
  },
];

export default function PricingPage() {
  return (
    <main className="bg-white">
      {/* Header */}
      <section className="py-20 px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-lg text-gray-500">
          All plans include a 14-day free trial. No credit card required.
        </p>
      </section>

      {/* Pricing cards */}
      <section className="pb-24 px-4">
        <div className="mx-auto max-w-5xl grid grid-cols-1 gap-8 sm:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={[
                "relative flex flex-col rounded-2xl p-8 shadow-sm",
                tier.featured
                  ? "border-2 border-indigo-600 bg-white"
                  : "border border-gray-200 bg-white",
              ].join(" ")}
            >
              {tier.featured && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                  Most Popular
                </span>
              )}

              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {tier.name}
                </h2>
                <p className="mt-1 text-sm text-gray-500">{tier.description}</p>
                <p className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-gray-900">
                    {tier.price}
                  </span>
                  <span className="text-gray-500">/month</span>
                </p>
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check
                      className={[
                        "mt-0.5 h-5 w-5 flex-shrink-0",
                        tier.featured ? "text-indigo-600" : "text-green-500",
                      ].join(" ")}
                    />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href={tier.ctaHref}
                className={[
                  "block rounded-lg px-6 py-3 text-center text-sm font-semibold transition-colors",
                  tier.featured
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "bg-gray-100 text-gray-900 hover:bg-gray-200",
                ].join(" ")}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gray-50 py-20 px-4">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-10">
            Frequently asked questions
          </h2>
          <dl className="space-y-8">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <dt className="text-base font-semibold text-gray-900">
                  {faq.question}
                </dt>
                <dd className="mt-2 text-sm text-gray-600 leading-relaxed">
                  {faq.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 px-4 text-center">
        <p className="text-gray-500 text-sm">
          Still have questions?{" "}
          <a
            href="/contact"
            className="font-semibold text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
          >
            Chat with us.
          </a>
        </p>
      </section>
    </main>
  );
}
