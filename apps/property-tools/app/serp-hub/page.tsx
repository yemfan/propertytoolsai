import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SERP keyword clusters | PropertyTools AI",
  description: "Five page types per keyword: tool, landing, blog, comparison, FAQ — generated for topical dominance.",
};

export default function SerpHubIndexPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold mb-4">SERP Dominator clusters</h1>
      <p className="text-slate-600 mb-6">
        Pages are created under <code className="bg-slate-200 px-1 rounded">/serp-hub/&#123;keyword-slug&#125;/&#123;pageType&#125;</code>{" "}
        via the generate API. Example types: <code>tool</code>, <code>landing</code>, <code>blog</code>,{" "}
        <code>comparison</code>, <code>faq</code>.
      </p>
      <Link href="/guides" className="text-blue-700 font-medium hover:underline">
        ← Guides
      </Link>
    </div>
  );
}
