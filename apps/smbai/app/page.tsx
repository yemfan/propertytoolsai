/**
 * Root page — public landing for guests, redirect to /home for authenticated users.
 * Includes MarketingNav + MarketingFooter directly (outside the (marketing) route group).
 */

import Link from "next/link";
import { Phone, Inbox, Receipt, Calendar, Users, Sunrise, CheckCircle, Star } from "lucide-react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function RootPage() {

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <MarketingNav />

      <main className="flex-1 text-gray-900">
        {/* HERO */}
        <section className="relative overflow-hidden bg-white">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <div className="h-[600px] w-[600px] rounded-full bg-indigo-100 opacity-50 blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-5xl px-6 py-24 text-center sm:py-32">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
              <Star className="h-4 w-4 fill-indigo-400 text-indigo-400" />
              Trusted by 500+ small businesses
            </div>
            <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Your business answers every call, sends every invoice, and never misses a beat&nbsp;—{" "}
              <span className="text-indigo-600">automatically.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-500 sm:text-xl">
              HelmSmart gives small businesses a 24/7 AI front office. More control, less effort.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/signup" className="inline-flex items-center rounded-xl bg-indigo-600 px-7 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors">
                Start free trial
              </Link>
              <a href="#features" className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-7 py-3.5 text-base font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors">
                See how it works
              </a>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="bg-gray-50 py-20 sm:py-28">
          <div className="mx-auto max-w-5xl px-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">How it works</h2>
              <p className="mt-3 text-lg text-gray-500">HelmSmart runs your front office so you can focus on the work you love.</p>
            </div>
            <div className="mt-14 grid gap-6 sm:grid-cols-3">
              {[
                { step: "01", title: "A customer calls", description: "Your AI receptionist answers every call 24/7, collects details, and books the appointment directly into your calendar — no hold music, no voicemail." },
                { step: "02", title: "Invoice is sent", description: "The moment a job is marked complete, HelmSmart auto-generates the invoice, emails it to your client, and tracks payment status in real time." },
                { step: "03", title: "You wake up informed", description: "Each morning your AI briefing surfaces today's appointments, overdue invoices, and any urgent messages — so you always know what matters most." },
              ].map((item) => (
                <div key={item.step} className="relative rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                  <span className="text-5xl font-black text-indigo-50 select-none">{item.step}</span>
                  <h3 className="mt-2 text-lg font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="py-20 sm:py-28">
          <div className="mx-auto max-w-5xl px-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Everything your front office needs</h2>
              <p className="mt-3 text-lg text-gray-500">Six powerful tools, one simple platform.</p>
            </div>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Phone,   color: "text-indigo-600 bg-indigo-50", title: "Voice AI Receptionist", description: "Answers every inbound call around the clock. Books appointments, captures leads, and routes urgent calls — no human operator needed." },
                { icon: Inbox,   color: "text-emerald-600 bg-emerald-50", title: "Smart Inbox",         description: "Email and SMS in one place. AI triage surfaces urgent messages, drafts replies, and keeps your inbox from becoming a distraction." },
                { icon: Receipt, color: "text-amber-600 bg-amber-50",   title: "Invoicing & Bookkeeping", description: "Create and send invoices in seconds. Track expenses, flag overdue payments, and get a real-time view of your cash flow." },
                { icon: Calendar,color: "text-violet-600 bg-violet-50", title: "Calendar & Scheduling", description: "Syncs with Google Calendar so bookings land where you already live. Avoid double-bookings and automated reminders handle no-shows." },
                { icon: Users,   color: "text-rose-600 bg-rose-50",     title: "Client CRM",            description: "Track every client, deal, and follow-up in a simple pipeline. Know exactly where each relationship stands without digging through notes." },
                { icon: Sunrise, color: "text-sky-600 bg-sky-50",       title: "AI Daily Briefing",     description: "Start each morning with a plain-English summary of your day — top priorities, upcoming appointments, and anything that needs your attention." },
              ].map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="rounded-2xl border border-gray-100 bg-white p-7 shadow-sm">
                    <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${feature.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-gray-900">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-500">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* STATS */}
        <section className="border-y border-gray-100 bg-gray-50 py-14">
          <div className="mx-auto max-w-4xl px-6">
            <dl className="grid gap-10 sm:grid-cols-3 sm:gap-0 text-center">
              {[
                { stat: "24/7",      label: "Always-on AI receptionist" },
                { stat: "< 2 min",   label: "Average time to book an appointment" },
                { stat: "10+ hours", label: "Admin time saved per week" },
              ].map((item) => (
                <div key={item.stat} className="sm:border-r sm:border-gray-200 last:border-0 px-4">
                  <dt className="text-4xl font-extrabold text-indigo-600">{item.stat}</dt>
                  <dd className="mt-2 text-sm text-gray-500">{item.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* TESTIMONIAL */}
        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Real businesses. Real results.</h2>
            <div className="mt-12 rounded-2xl border border-gray-100 bg-white p-10 shadow-sm">
              <div className="flex justify-center gap-1 mb-6">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />)}
              </div>
              <blockquote className="text-lg leading-relaxed text-gray-700 italic">
                &ldquo;Before HelmSmart I was losing jobs every week because I couldn&rsquo;t answer the phone while on-site. Now the AI picks up every call, books the job, and sends me a summary. I haven&rsquo;t missed a lead in months — and my invoices actually go out the same day.&rdquo;
              </blockquote>
              <div className="mt-6 flex items-center justify-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">SK</div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-900">Sarah K.</p>
                  <p className="text-xs text-gray-500">Owner, Bright &amp; Clean Services</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-4xl px-6">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-16 text-center shadow-xl sm:px-16">
              <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white opacity-5" aria-hidden="true" />
              <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white opacity-5" aria-hidden="true" />
              <div className="relative">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white">
                  <CheckCircle className="h-4 w-4" />
                  14-day free trial · No credit card required
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Ready to take the helm?</h2>
                <p className="mt-4 text-lg text-indigo-100">Start your 14-day free trial — no credit card required.</p>
                <div className="mt-10">
                  <Link href="/signup" className="inline-flex items-center rounded-xl bg-white px-8 py-4 text-base font-semibold text-indigo-600 shadow-sm hover:bg-indigo-50 transition-colors">
                    Start free trial
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
