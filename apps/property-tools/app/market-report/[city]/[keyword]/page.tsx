import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LocalSeoLeadForm from "@/components/LocalSeoLeadForm";
import TrafficTracker from "@/components/TrafficTracker";
import {
  estimateKeywordRouteCount,
  formatCurrency,
  getCityBySlug,
  getKeywordPagesForCity,
  getMarketSnapshot,
  getNearbyCities,
  isValidKeywordSlugForCity,
  TRAFFIC_CITIES,
} from "@/lib/trafficSeo";

export function generateStaticParams() {
  return TRAFFIC_CITIES.flatMap((city) =>
    getKeywordPagesForCity("market-report", city.slug).map((k) => ({
      city: city.slug,
      keyword: k.keywordSlug,
    }))
  );
}

function resolveKeyword(citySlug: string, keywordSlug: string) {
  return getKeywordPagesForCity("market-report", citySlug).find((k) => k.keywordSlug === keywordSlug)?.keyword ?? "";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; keyword: string }>;
}): Promise<Metadata> {
  const p = await params;
  const city = getCityBySlug(p.city);
  if (!city || !isValidKeywordSlugForCity("market-report", p.city, p.keyword)) return {};
  const keyword = resolveKeyword(p.city, p.keyword);
  return {
    title: `${keyword} | ${city.city}, ${city.state} | PropertyTools AI`,
    description: `Track ${keyword} with local pricing and trend data for ${city.city}, ${city.state}.`,
  };
}

export default async function MarketReportKeywordPage({
  params,
}: {
  params: Promise<{ city: string; keyword: string }>;
}) {
  const p = await params;
  const city = getCityBySlug(p.city);
  if (!city || !isValidKeywordSlugForCity("market-report", p.city, p.keyword)) return notFound();
  const keyword = resolveKeyword(p.city, p.keyword);
  const market = getMarketSnapshot(p.city);
  const nearby = getNearbyCities(p.city, 4);

  return (
    <div className="w-full max-w-6xl py-6 sm:py-10">
      <TrafficTracker pagePath={`/market-report/${city.slug}/${p.keyword}`} city={city.city} source="seo_market_report_keyword" />
      <h1 className="mb-2 text-3xl font-bold text-blue-600">{keyword}</h1>
      <p className="mb-2 text-gray-600">
        Local market report content for {city.city}, {city.state}, built for long-tail SEO intent.
      </p>
      <p className="mt-1 text-xs text-slate-500">Programmatic keyword routes: {estimateKeywordRouteCount().toLocaleString()}+</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Metric label="Median Value" value={formatCurrency(market.avgHomeValue)} />
        <Metric label="Price Per Sqft" value={formatCurrency(market.pricePerSqft)} />
        <Metric label="Annual Trend" value={`${market.yoyChangePct}%`} />
      </div>

      <section className="mt-8 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Seller insight</h2>
          <p className="mt-2 text-sm text-slate-700">
            In {city.city}, market speed is around {market.medianDaysOnMarket} days with seller demand at {market.sellerDemandScore}/100.
          </p>
          <h3 className="mt-4 text-base font-semibold text-slate-900">Nearby city links</h3>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {nearby.map((n) => (
              <a key={n.slug} href={`/market-report/${n.slug}/${p.keyword}`} className="text-blue-700 hover:underline">
                {keyword} in {n.city}
              </a>
            ))}
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900">Related pages</h3>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <a href={`/home-value/${city.slug}/${p.keyword}`} className="text-blue-700 hover:underline">Home value keyword page</a>
            <a href={`/sell-house/${city.slug}/${p.keyword}`} className="text-blue-700 hover:underline">Sell house keyword page</a>
          </div>
        </article>
        <LocalSeoLeadForm title={`Get ${city.city} Market Report`} source="seo_market_report_keyword" city={city.city} />
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
