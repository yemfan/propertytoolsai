import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog | PropertyTools AI",
  description: "Real estate investing, cap rate, mortgages, and property analysis articles.",
  alternates: {
    canonical: "/blog",
  },
};

const POSTS: { href: string; title: string }[] = [
  { href: "/blog/what-is-cap-rate", title: "What is cap rate?" },
  { href: "/blog/how-to-calculate-cap-rate", title: "How to calculate cap rate" },
  { href: "/blog/cap-rate-vs-cash-on-cash-return", title: "Cap rate vs cash-on-cash return" },
  { href: "/blog/cap-rate-calculator-how-to-use-it", title: "How to use a cap rate calculator" },
  { href: "/blog/why-cap-rate-matters-for-real-estate-investors", title: "Why cap rate matters" },
  { href: "/blog/how-cap-rate-affects-property-value", title: "How cap rate affects property value" },
];

export default function BlogIndexPage() {
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.28]"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 45% at 50% 0%, rgba(0,114,206,0.12), transparent 50%)",
        }}
      />
      <div className="relative mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:py-16">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#0072ce]">Blog</p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Articles &amp; guides
          </h1>
          <p className="text-base text-slate-600">Education for buyers, sellers, and investors.</p>
        </header>
        <ul className="mt-10 space-y-3">
          {POSTS.map((p) => (
            <li key={p.href}>
              <Link href={p.href} className="block">
                <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-4 text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.04] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0072ce]/30 hover:text-[#0072ce] hover:shadow-lg hover:shadow-slate-900/[0.08]">
                  <span className="font-heading font-semibold">{p.title}</span>
                  <span className="mt-1 block text-xs font-medium text-slate-500">Read article →</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
