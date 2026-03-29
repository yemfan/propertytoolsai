import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSerpPageByPath } from "@/lib/serpDominator/db";
import { buildSerpHubPath } from "@/lib/serpDominator/slug";
import { SERP_PAGE_TYPES } from "@/lib/serpDominator/types";
import type { SerpPagePayload } from "@/lib/serpDominator/types";
import type { SnippetBlock } from "@/lib/serpDominator/types";

type Props = { params: Promise<{ keywordSlug: string; pageType: string }> };

export const revalidate = 86400;
export const dynamicParams = true;

function isSerpPageType(s: string): s is (typeof SERP_PAGE_TYPES)[number] {
  return (SERP_PAGE_TYPES as readonly string[]).includes(s);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { keywordSlug, pageType } = await params;
  if (!isSerpPageType(pageType)) return { title: "SERP Hub | PropertyTools AI" };
  const path = buildSerpHubPath(keywordSlug, pageType);
  const row = await getSerpPageByPath(path);
  if (!row) return { title: "SERP Hub | PropertyTools AI" };
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://www.propertytools.ai";
  return {
    title: row.title,
    description: row.meta_description,
    alternates: { canonical: `${base}${path}` },
    openGraph: { title: row.title, description: row.meta_description, type: "article" },
  };
}

function SnippetBlocksSection({ blocks }: { blocks: SnippetBlock[] }) {
  if (!blocks.length) return null;
  return (
    <section aria-label="Featured snippet targets" className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6 space-y-4">
      <h2 className="text-lg font-bold text-amber-900">Snippet-ready blocks</h2>
      <p className="text-sm text-amber-900/80">
        Tight answers and lists you can refine for featured snippets &amp; PAA.
      </p>
      <div className="space-y-4 text-sm text-amber-950">
        {blocks.map((b, i) => {
          if (b.type === "paragraph") return <p key={i} className="leading-relaxed">{b.text}</p>;
          if (b.type === "bullets")
            return (
              <ul key={i} className="list-disc pl-5 space-y-1">
                {b.items.map((x, j) => (
                  <li key={j}>{x}</li>
                ))}
              </ul>
            );
          if (b.type === "definition")
            return (
              <dl key={i}>
                <dt className="font-semibold">{b.term}</dt>
                <dd className="mt-1 text-amber-900">{b.definition}</dd>
              </dl>
            );
          return null;
        })}
      </div>
    </section>
  );
}

function PayloadBody({ payload }: { payload: SerpPagePayload }) {
  return (
    <>
      {payload.lede && (
        <p className="text-lg text-slate-700 leading-relaxed border-l-4 border-blue-500 pl-4">{payload.lede}</p>
      )}
      {payload.toolCta && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 space-y-3">
          <h2 className="text-xl font-bold text-slate-900">{payload.toolCta.headline}</h2>
          <ul className="list-disc pl-5 text-slate-700 space-y-1">
            {payload.toolCta.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
          <Link href="/" className="inline-flex text-blue-700 font-semibold hover:underline">
            Open calculators →
          </Link>
        </div>
      )}
      {payload.comparisonRows && payload.comparisonRows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left p-3">Topic</th>
                <th className="text-left p-3">Option A</th>
                <th className="text-left p-3">Option B</th>
              </tr>
            </thead>
            <tbody>
              {payload.comparisonRows.map((r, i) => (
                <tr key={i} className="border-t border-slate-200">
                  <td className="p-3 font-medium">{r.label}</td>
                  <td className="p-3 text-slate-700">{r.a}</td>
                  <td className="p-3 text-slate-700">{r.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {payload.sections.map((sec, i) => (
        <div key={i} className="border-t border-slate-200 pt-8 first:border-t-0 first:pt-0">
          <h2 className="text-xl font-bold text-slate-900 mb-4">{sec.heading}</h2>
          <div className="space-y-4 text-slate-700 leading-relaxed">
            {sec.paragraphs.map((p, j) => (
              <p key={j}>{p}</p>
            ))}
          </div>
        </div>
      ))}
      {payload.faqs && payload.faqs.length > 0 && (
        <section aria-label="FAQ" className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900">FAQ</h2>
          {payload.faqs.map((f, i) => (
            <details key={i} className="rounded-xl border border-slate-200 bg-white p-4">
              <summary className="font-semibold cursor-pointer">{f.question}</summary>
              <p className="mt-2 text-sm text-slate-600">{f.answer}</p>
            </details>
          ))}
        </section>
      )}
    </>
  );
}

export default async function SerpHubPage({ params }: Props) {
  const { keywordSlug, pageType } = await params;
  if (!isSerpPageType(pageType)) notFound();

  const path = buildSerpHubPath(keywordSlug, pageType);
  const row = await getSerpPageByPath(path);
  if (!row) notFound();

  const payload = row.payload as SerpPagePayload;
  const links = Array.isArray(row.internal_links) ? row.internal_links : [];
  const snippets = Array.isArray(row.snippet_blocks) ? row.snippet_blocks : [];

  const faqJsonLd =
    payload.faqs && payload.faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: payload.faqs.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        }
      : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {faqJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      )}
      <article className="mx-auto max-w-3xl px-4 py-10 space-y-10">
        <nav className="text-sm">
          <Link href="/" className="font-medium text-blue-700 hover:underline">
            PropertyTools AI
          </Link>
          <span className="text-slate-400 mx-2">/</span>
          <span className="text-slate-600 capitalize">{pageType}</span>
        </nav>

        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">SERP cluster · {pageType}</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">{row.title}</h1>
          <p className="text-lg text-slate-600">{row.meta_description}</p>
        </header>

        <PayloadBody payload={payload} />

        <SnippetBlocksSection blocks={snippets} />

        {links.length > 0 && (
          <section aria-label="Cluster pages" className="pb-8">
            <h2 className="text-lg font-bold text-slate-900 mb-3">Related pages in this keyword cluster</h2>
            <ul className="grid sm:grid-cols-2 gap-2">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="block rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-blue-800 hover:border-blue-300 hover:bg-blue-50/50"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </div>
  );
}
