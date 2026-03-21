import type { Metadata } from "next";
import Link from "next/link";
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-12 space-y-10">
        <header className="space-y-2">
          <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Guides</p>
          <h1 className="text-3xl font-bold">Real estate guides by topic &amp; city</h1>
          <p className="text-slate-600 max-w-2xl">
            Thousands of programmatic URLs combine education topics with major metros. Use a topic below with your city
            slug, e.g.{" "}
            <code className="text-sm bg-slate-200 px-1 rounded">
              /guides/first-time-home-buyer-guide/los-angeles-ca
            </code>
            .
          </p>
        </header>

        <section>
          <h2 className="text-lg font-bold mb-4">Topics</h2>
          <ul className="grid sm:grid-cols-2 gap-2 text-sm">
            {sampleTopics.map((t) => (
              <li key={t.slug} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className="font-medium text-slate-900">{t.name}</span>
                <span className="text-slate-500 ml-2">/{t.slug}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-4">Example deep links</h2>
          <ul className="space-y-2 text-sm">
            {sampleCities.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <Link
                  href={buildGuidePath("first-time-home-buyer-guide", c.slug)}
                  className="text-blue-700 hover:underline"
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
