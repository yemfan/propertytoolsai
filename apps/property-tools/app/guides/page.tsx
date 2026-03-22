import type { Metadata } from "next";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { CLUSTER_TOPICS } from "@/lib/clusterGenerator/topics";
import { PROGRAMMATIC_SEO_LOCATIONS } from "@/lib/programmaticSeo/locations";
import { buildGuidePath } from "@/lib/clusterGenerator/slug";

export const metadata: Metadata = {
  title: "Real Estate Guides by City | PropertyTools AI",
  description:
    "Localized guides for buyers and investors. Browse topics and metros—content is generated programmatically for scale.",
};

/** Hub page: sample links (first topic × first few cities) — full matrix lives at /guides/[topic]/[location]. */
export default function GuidesHubPage() {
  const sampleCities = PROGRAMMATIC_SEO_LOCATIONS.slice(0, 12);
  const sampleTopics = CLUSTER_TOPICS.slice(0, 8);

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.28]"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 45% at 50% 0%, rgba(0,114,206,0.1), transparent 50%)",
        }}
      />
      <div className="relative mx-auto max-w-4xl space-y-10 px-4 py-12">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#0072ce]">Guides</p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Real estate guides by topic &amp; city
          </h1>
          <p className="max-w-2xl text-base text-slate-600">
            Thousands of programmatic URLs combine education topics with major metros. Use a topic below with your city
            slug, e.g.{" "}
            <code className="rounded-md bg-slate-100 px-1.5 py-0.5 text-sm text-slate-800">
              /guides/first-time-home-buyer-guide/los-angeles-ca
            </code>
            .
          </p>
        </header>

        <section>
          <h2 className="font-heading mb-4 text-lg font-bold text-slate-900">Topics</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {sampleTopics.map((t) => (
              <li key={t.slug}>
                <Card className="px-3 py-3 text-sm">
                  <span className="font-semibold text-slate-900">{t.name}</span>
                  <span className="ml-2 text-slate-500">/{t.slug}</span>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-heading mb-4 text-lg font-bold text-slate-900">Example deep links</h2>
          <ul className="space-y-2 text-sm">
            {sampleCities.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <Link
                  href={buildGuidePath("first-time-home-buyer-guide", c.slug)}
                  className="font-medium text-[#0072ce] hover:text-[#005ca8] hover:underline"
                >
                  First-time buyer guide — {c.city}, {c.state}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
