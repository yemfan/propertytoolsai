import type { Metadata } from "next";
import Link from "next/link";
import { listSerpHubCampaignsWithPublishedPages } from "@/lib/serpDominator/db";
import { buildSerpHubPath } from "@/lib/serpDominator/slug";
import { SERP_PAGE_TYPES } from "@/lib/serpDominator/types";

export const metadata: Metadata = {
  title: "SERP keyword clusters | PropertyTools AI",
  description:
    "Five page types per keyword: tool, landing, blog, comparison, FAQ — generated for topical dominance.",
};

export const revalidate = 120;

function pageTypeLabel(t: string): string {
  if (t === "faq") return "FAQ";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default async function SerpHubIndexPage() {
  const clusters = await listSerpHubCampaignsWithPublishedPages(80);

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-50 via-white to-white text-slate-900">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.28]"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 45% at 50% 0%, rgba(0,114,206,0.1), transparent 50%)",
        }}
      />
      <div className="relative mx-auto max-w-4xl space-y-10 px-4 py-12">
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
          <Link href="/" className="font-medium text-[#0072ce] hover:text-[#005ca8] hover:underline">
            Home
          </Link>
          <span className="text-slate-300" aria-hidden>
            /
          </span>
          <span className="font-medium text-slate-900">SERP clusters</span>
          <span className="text-slate-300" aria-hidden>
            ·
          </span>
          <Link href="/guides" className="text-[#0072ce] hover:text-[#005ca8] hover:underline">
            City &amp; topic guides
          </Link>
        </nav>

        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#0072ce]">SERP Dominator</p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Keyword clusters
          </h1>
          <p className="max-w-2xl text-base text-slate-600">
            Pages are created under{" "}
            <code className="rounded-md bg-slate-100 px-1.5 py-0.5 text-sm text-slate-800">
              /serp-hub/&#123;keyword-slug&#125;/&#123;pageType&#125;
            </code>{" "}
            via{" "}
            <code className="rounded-md bg-slate-100 px-1.5 py-0.5 text-sm text-slate-800">
              POST /api/seo/serp-dominator/generate
            </code>
            . Types:{" "}
            {SERP_PAGE_TYPES.map((t, i) => (
              <span key={t}>
                {i > 0 ? ", " : null}
                <code className="rounded bg-slate-100 px-1 text-sm">{t}</code>
              </span>
            ))}
            .
          </p>
        </header>

        {clusters.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">No published clusters yet</h2>
            <p className="mt-2 text-sm text-slate-600">
              After you run the generate API with a seed keyword, five URLs are written to the database and appear here.
            </p>
            <p className="mt-4 text-xs text-slate-500">
              See <code className="rounded bg-slate-100 px-1">docs/SERP_DOMINATOR.md</code> for payload shape and env
              vars.
            </p>
          </section>
        ) : (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Published clusters ({clusters.length})
            </h2>
            <ul className="space-y-4">
              {clusters.map((c) => (
                <li
                  key={c.keyword_slug}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-slate-900">{c.seed_keyword}</p>
                    <code className="text-xs text-slate-500">{c.keyword_slug}</code>
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {SERP_PAGE_TYPES.map((pt) => (
                      <li key={pt}>
                        <Link
                          href={buildSerpHubPath(c.keyword_slug, pt)}
                          className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-[#0072ce] hover:border-[#0072ce]/40 hover:bg-blue-50/80"
                        >
                          {pageTypeLabel(pt)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
