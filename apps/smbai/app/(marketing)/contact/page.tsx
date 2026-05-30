import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageSquare, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact — HelmSmart",
  description: "Get in touch with the HelmSmart team. We're here to help.",
};

const channels = [
  {
    icon: Mail,
    title: "Email us",
    description: "For general questions, billing, or anything else.",
    contact: "hello@helmsmart.ai",
    href: "mailto:hello@helmsmart.ai",
    color: "text-indigo-600 bg-indigo-50",
  },
  {
    icon: MessageSquare,
    title: "Support",
    description: "Need help with your account or a technical issue?",
    contact: "support@helmsmart.ai",
    href: "mailto:support@helmsmart.ai",
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    icon: Clock,
    title: "Response time",
    description: "We typically reply within one business day.",
    contact: "Mon – Fri, 9 am – 6 pm PT",
    href: null,
    color: "text-amber-600 bg-amber-50",
  },
];

export default function ContactPage() {
  return (
    <div className="bg-white">

      {/* Hero */}
      <section className="border-b border-gray-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-3xl px-6 py-20 sm:py-28 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Get in touch
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            Questions, feedback, or just want to say hi — we&apos;d love to hear from you.
          </p>
        </div>
      </section>

      {/* Contact channels */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="grid gap-6 sm:grid-cols-3">
          {channels.map((channel) => {
            const Icon = channel.icon;
            const inner = (
              <>
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${channel.color} mb-4`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{channel.title}</h3>
                <p className="text-sm text-gray-500 mb-3 leading-relaxed">{channel.description}</p>
                <p className="text-sm font-medium text-gray-700">{channel.contact}</p>
              </>
            );

            return channel.href ? (
              <a
                key={channel.title}
                href={channel.href}
                className="rounded-2xl border border-gray-100 bg-white p-7 shadow-sm hover:shadow-md transition-shadow block"
              >
                {inner}
              </a>
            ) : (
              <div key={channel.title} className="rounded-2xl border border-gray-100 bg-white p-7 shadow-sm">
                {inner}
              </div>
            );
          })}
        </div>
      </section>

      {/* Contact form */}
      <section className="mx-auto max-w-2xl px-6 pb-20">
        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Send us a message</h2>
          <form
            action="mailto:hello@helmsmart.ai"
            method="GET"
            className="space-y-5"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="Jane Smith"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="jane@example.com"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                Subject
              </label>
              <select
                id="subject"
                name="subject"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="general">General question</option>
                <option value="sales">Pricing & plans</option>
                <option value="support">Technical support</option>
                <option value="billing">Billing</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                Message
              </label>
              <textarea
                id="message"
                name="body"
                rows={5}
                required
                placeholder="Tell us how we can help..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors"
            >
              Send message
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-400">
          Also check out our{" "}
          <Link href="/faq" className="text-indigo-600 hover:text-indigo-700 font-medium">
            FAQ
          </Link>
          {" "}— most questions are answered there.
        </p>
      </section>
    </div>
  );
}
