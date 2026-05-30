import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog — HelmSmart",
  description: "Tips, guides, and insights for small business owners.",
};

interface BlogPost {
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: string;
  color: "indigo" | "emerald" | "amber" | "violet";
  href: string;
}

const pains = [
  {
    pain: "Missed calls while on the job",
    solution: "AI Voice Receptionist answers every call 24/7 — books appointments and takes messages while you work.",
    icon: "📞",
  },
  {
    pain: "Expensive after-hours answering services",
    solution: "Replace costly on-call staff and third-party call centres with an AI that costs a fraction of the price.",
    icon: "💸",
  },
  {
    pain: "10+ hours a week on admin",
    solution: "Smart Inbox triages emails and SMS, drafts replies, and flags what actually needs your attention.",
    icon: "⏰",
  },
  {
    pain: "Invoices that go out late — or not at all",
    solution: "Automated invoicing sends bills the moment a job is done and follows up on overdue payments.",
    icon: "📄",
  },
  {
    pain: "Double-bookings and scheduling chaos",
    solution: "Calendar sync and AI booking mean appointments land in the right slot — automatically.",
    icon: "📅",
  },
  {
    pain: "Leads slipping through the cracks",
    solution: "Client CRM and pipeline tracking keep every prospect and customer visible in one place.",
    icon: "🎯",
  },
];

const posts: BlogPost[] = [
  {
    title: "Small Business Pains — And How HelmSmart Solves Them",
    excerpt:
      "Missed calls, admin overload, late invoices, expensive after-hours services — sound familiar? Here's exactly how HelmSmart addresses the six biggest headaches small business owners face every day.",
    category: "Strategy",
    date: "May 22, 2025",
    readTime: "6 min read",
    color: "indigo",
    href: "/blog/smb-pains-and-solutions",
  },
  {
    title: "How AI Receptionists Are Helping Small Businesses Never Miss a Call",
    excerpt:
      "Every missed call is a potential lost customer. Here's how AI voice technology is changing the game for service businesses.",
    category: "Voice AI",
    date: "May 15, 2025",
    readTime: "5 min read",
    color: "indigo",
    href: "/blog/ai-receptionist-guide",
  },
  {
    title: "The True Cost of Admin Work for Small Business Owners",
    excerpt:
      "The average small business owner spends 10+ hours per week on administrative tasks. Here's how to take that time back.",
    category: "Productivity",
    date: "May 8, 2025",
    readTime: "4 min read",
    color: "emerald",
    href: "/blog/cost-of-admin-work",
  },
  {
    title: "5 Ways to Get Paid Faster as a Service Business",
    excerpt:
      "Late payments kill cash flow. These proven strategies — including automated invoicing — can cut your payment cycle in half.",
    category: "Finance",
    date: "April 30, 2025",
    readTime: "6 min read",
    color: "amber",
    href: "/blog/get-paid-faster",
  },
  {
    title: "Setting Up Your AI Receptionist: A Step-by-Step Guide",
    excerpt:
      "A complete walkthrough of configuring HelmSmart's voice agent — from business hours to appointment types to knowledge base.",
    category: "Guide",
    date: "April 22, 2025",
    readTime: "8 min read",
    color: "violet",
    href: "/blog/ai-receptionist-setup",
  },
];

const colorMap: Record<
  BlogPost["color"],
  { badge: string; bar: string; categoryText: string }
> = {
  indigo: {
    badge: "bg-indigo-50 text-indigo-700",
    bar: "bg-indigo-500",
    categoryText: "text-indigo-600",
  },
  emerald: {
    badge: "bg-emerald-50 text-emerald-700",
    bar: "bg-emerald-500",
    categoryText: "text-emerald-600",
  },
  amber: {
    badge: "bg-amber-50 text-amber-700",
    bar: "bg-amber-500",
    categoryText: "text-amber-600",
  },
  violet: {
    badge: "bg-violet-50 text-violet-700",
    bar: "bg-violet-500",
    categoryText: "text-violet-600",
  },
};

function BlogCard({ post }: { post: BlogPost }) {
  const colors = colorMap[post.color];

  return (
    <Link
      href={post.href}
      className="group flex flex-col rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
    >
      {/* color accent bar */}
      <div className={`h-1.5 w-full ${colors.bar}`} />

      <div className="flex flex-col flex-1 p-6 gap-4">
        {/* category + meta */}
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.badge}`}
          >
            {post.category}
          </span>
          <span className="text-xs text-gray-400">{post.readTime}</span>
        </div>

        {/* title */}
        <h2 className="text-gray-900 font-semibold text-lg leading-snug group-hover:text-gray-700 transition-colors">
          {post.title}
        </h2>

        {/* excerpt */}
        <p className="text-gray-500 text-sm leading-relaxed flex-1">
          {post.excerpt}
        </p>

        {/* footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
          <span className="text-xs text-gray-400">{post.date}</span>
          <span className={`text-sm font-medium ${colors.categoryText}`}>
            Read more
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function BlogPage() {
  return (
    <div className="bg-white">
      {/* hero */}
      <section className="mx-auto max-w-4xl px-4 pt-20 pb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          The HelmSmart Blog
        </h1>
        <p className="mt-4 text-lg text-gray-500">
          Tips, guides, and insights for small business owners.
        </p>
      </section>

      {/* Pains & Solutions */}
      <section className="bg-slate-50 border-y border-slate-100 py-16">
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Small business pains — solved
            </h2>
            <p className="mt-3 text-gray-500 text-base max-w-xl mx-auto">
              Every feature in HelmSmart was built around a real pain that small business owners told us about.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pains.map((item) => (
              <div key={item.pain} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <span className="text-3xl mb-4 block">{item.icon}</span>
                <h3 className="font-semibold text-gray-900 mb-2">{item.pain}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.solution}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* post grid */}
      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {posts.map((post) => (
            <BlogCard key={post.href} post={post} />
          ))}
        </div>
      </section>

      {/* subscribe CTA */}
      <section className="border-t border-gray-100 bg-gray-50 py-16">
        <div className="mx-auto max-w-xl px-4 text-center">
          <p className="text-gray-600 text-base mb-6">
            More posts coming soon. Subscribe for updates.
          </p>
          <form className="flex flex-col sm:flex-row items-center gap-3 justify-center">
            <label htmlFor="blog-email" className="sr-only">
              Email address
            </label>
            <input
              id="blog-email"
              type="email"
              placeholder="you@example.com"
              className="w-full sm:w-64 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              type="submit"
              className="w-full sm:w-auto rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors"
            >
              Notify me
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
