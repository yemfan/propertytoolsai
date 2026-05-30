import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — HelmSmart",
  description:
    "HelmSmart is an AI-powered front office for small businesses — built by the team behind LeadSmart AI. More control, less effort.",
};

const values = [
  {
    title: "Pain first, features second",
    description:
      "Every tool we build starts with a real problem small business owners told us about. We don't add features for the sake of it.",
  },
  {
    title: "AI that actually works",
    description:
      "We've spent years building production AI systems. HelmSmart uses the same battle-tested AI infrastructure behind LeadSmart AI.",
  },
  {
    title: "Plain-English clarity",
    description:
      "No dashboards full of jargon. Everything HelmSmart surfaces is written the way you'd say it out loud.",
  },
  {
    title: "Always in your corner",
    description:
      "We're a small team that cares. When something breaks or doesn't work the way you expect, a real person fixes it.",
  },
];

export default function AboutPage() {
  return (
    <div className="bg-white text-gray-900">

      {/* Hero */}
      <section className="border-b border-gray-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-4xl px-6 py-20 sm:py-28">
          <p className="mb-4 inline-flex rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gray-500 shadow-sm">
            Our story
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl leading-tight">
            Built for the business owner who does it all
          </h1>
          <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-2xl">
            HelmSmart gives small business owners a 24/7 AI front office — so they can stop missing calls,
            drowning in admin, and chasing late payments. More control, less effort.
          </p>
        </div>
      </section>

      {/* Origin story */}
      <section className="mx-auto max-w-4xl px-6 py-20">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl mb-6">
              Where HelmSmart came from
            </h2>
            <div className="space-y-4 text-gray-600 leading-relaxed">
              <p>
                We built <Link href="https://leadsmart-ai.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-600 hover:text-indigo-700">LeadSmart AI</Link> —
                an AI growth platform for real estate agents and mortgage professionals — and watched it transform
                how thousands of professionals handle leads, follow-ups, and client communication.
              </p>
              <p>
                Along the way, we kept hearing the same story from a different crowd: plumbers, salon owners,
                contractors, consultants, and every other small business owner who isn&apos;t a real estate agent but
                faces the exact same problems. Missed calls. Admin overload. Invoices that go out late.
                Expensive after-hours answering services.
              </p>
              <p>
                HelmSmart is our answer. The same AI infrastructure and product philosophy behind LeadSmart AI —
                rebuilt from the ground up for every small business that needs a smarter front office.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-slate-50 p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Our sibling product</p>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-lg">
                L
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">LeadSmart AI</h3>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  AI growth engine for real estate agents and mortgage professionals —
                  capturing, qualifying, and converting leads automatically.
                </p>
                <Link
                  href="https://leadsmart-ai.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Visit LeadSmart AI →
                </Link>
              </div>
            </div>
            <div className="mt-6 border-t border-gray-200 pt-6">
              <p className="text-xs text-gray-400 leading-relaxed">
                Both products are built by the same team and share the same commitment:
                AI that actually works, built around real-world pain, not feature lists.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="bg-gray-50 border-y border-gray-100 py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl mb-6">Our mission</h2>
          <p className="text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
            To give every small business owner the same AI-powered front office that large businesses
            take for granted — at a price that actually makes sense.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="mx-auto max-w-4xl px-6 py-20">
        <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl mb-12 text-center">How we work</h2>
        <div className="grid gap-8 sm:grid-cols-2">
          {values.map((value) => (
            <div key={value.title} className="rounded-2xl border border-gray-100 bg-white p-7 shadow-sm">
              <h3 className="font-semibold text-gray-900 text-base mb-2">{value.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{value.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-3xl rounded-3xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-16 text-center shadow-xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Ready to take the helm?
          </h2>
          <p className="mt-4 text-lg text-indigo-100">
            14-day free trial — no credit card required.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center rounded-xl bg-white px-8 py-4 text-base font-semibold text-indigo-600 shadow-sm hover:bg-indigo-50 transition-colors"
            >
              Start free trial
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center rounded-xl border border-white/30 px-8 py-4 text-base font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Talk to us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
