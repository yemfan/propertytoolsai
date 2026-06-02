import type { Metadata } from "next";
import Link from "next/link";
import {
  Phone,
  PhoneOutgoing,
  Inbox,
  Receipt,
  CalendarDays,
  Users,
  Sunrise,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Features — HelmSmart",
  description:
    "One platform that handles calls, messages, books, and clients — while you focus on the work.",
};

interface Feature {
  id: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  placeholderColor: string;
  headline: string;
  subheadline: string;
  bullets: string[];
}

const features: Feature[] = [
  {
    id: "ai-receptionist",
    icon: <Phone className="h-6 w-6" />,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    placeholderColor: "bg-indigo-200",
    headline: "AI Receptionist",
    subheadline: "Never miss a call again",
    bullets: [
      "Answers calls 24/7 — even when you're on the job",
      "Cuts the cost of after-hours answering services and on-call staff",
      "Books appointments directly to your Google Calendar",
      "Takes messages and routes them to the right person",
      "Handles FAQs so you don't have to repeat yourself",
      "Sends a post-call summary straight to your inbox",
    ],
  },
  {
    id: "outbound-calling",
    icon: <PhoneOutgoing className="h-6 w-6" />,
    color: "text-teal-600",
    bgColor: "bg-teal-50",
    placeholderColor: "bg-teal-200",
    headline: "AI Outbound Calling",
    subheadline: "Your AI makes the calls you don't have time for",
    bullets: [
      "Appointment confirmations & reminders — cut no-shows automatically",
      "Lead and past-client follow-ups, on time every time",
      "Surveys and review requests once the job's done",
      "Promos and announcements to the right group of clients",
      "Every call logged with a summary and the outcome",
    ],
  },
  {
    id: "ai-assistant",
    icon: <Sparkles className="h-6 w-6" />,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    placeholderColor: "bg-blue-200",
    headline: "HelmSmart AI Assistant",
    subheadline: "Your business co-pilot, one tap away",
    bullets: [
      "Ask plain-English questions — \"what's overdue?\", \"how's cash flow?\", \"who should I follow up with?\"",
      "Answers come from your live business data, not generic advice",
      "Drafts the perfect text to any client in seconds — then sends it for you",
      "Auto Pilot can reply to a client's incoming texts automatically, in their language",
      "Floats on every screen, so help is always within reach",
    ],
  },
  {
    id: "smart-inbox",
    icon: <Inbox className="h-6 w-6" />,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    placeholderColor: "bg-emerald-200",
    headline: "Smart Inbox",
    subheadline: "Every message, handled intelligently",
    bullets: [
      "Email and SMS unified in one clean inbox",
      "AI triage flags urgent messages vs. routine ones",
      "Auto-replies acknowledge clients instantly",
      "Missed-call text-back — a missed call becomes a friendly text, so the lead doesn't slip away",
      "Detects language and responds accordingly",
    ],
  },
  {
    id: "invoicing",
    icon: <Receipt className="h-6 w-6" />,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    placeholderColor: "bg-amber-200",
    headline: "Invoicing & Bookkeeping",
    subheadline: "Get paid faster, stay on top of your books",
    bullets: [
      "Create and send professional invoices in seconds",
      "Track expenses and categorize automatically",
      "Bank reconciliation without the spreadsheet headache",
      "Profit & loss reports ready when you need them",
    ],
  },
  {
    id: "calendar",
    icon: <CalendarDays className="h-6 w-6" />,
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    placeholderColor: "bg-violet-200",
    headline: "Calendar & Scheduling",
    subheadline: "Your calendar, always current",
    bullets: [
      "Two-way Google Calendar sync keeps everything aligned",
      "Clients can book open slots without back-and-forth",
      "Automated reminders reduce no-shows",
      "Manage availability across multiple team members",
    ],
  },
  {
    id: "crm",
    icon: <Users className="h-6 w-6" />,
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    placeholderColor: "bg-rose-200",
    headline: "Client CRM & Pipeline",
    subheadline: "Know every client, close every deal",
    bullets: [
      "Full client profiles with contact history",
      "Visual deal pipeline from lead to closed",
      "Notes and follow-up reminders in one place",
      "Import existing contacts in minutes",
    ],
  },
  {
    id: "daily-briefing",
    icon: <Sunrise className="h-6 w-6" />,
    color: "text-sky-600",
    bgColor: "bg-sky-50",
    placeholderColor: "bg-sky-200",
    headline: "AI Daily Briefing",
    subheadline: "Start every day knowing what matters",
    bullets: [
      "Morning summary of overdue invoices that need attention",
      "Today's calls and appointments at a glance",
      "Unread messages ranked by urgency",
      "Tasks due so nothing slips through the cracks",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="px-6 py-20 text-center max-w-3xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
          Everything your front office needs
        </h1>
        <p className="mt-5 text-xl text-gray-500 leading-relaxed">
          One platform that handles calls, messages, books, and clients — while
          you focus on the work.
        </p>
      </section>

      {/* Feature Blocks */}
      <section className="max-w-6xl mx-auto px-6 pb-24 space-y-28">
        {features.map((feature, index) => {
          const isImageLeft = index % 2 === 0;

          return (
            <div
              key={feature.id}
              className={`flex flex-col gap-12 items-center ${
                isImageLeft ? "lg:flex-row" : "lg:flex-row-reverse"
              }`}
            >
              {/* Placeholder visual */}
              <div className="w-full lg:w-1/2 flex-shrink-0">
                <div
                  className={`${feature.placeholderColor} rounded-2xl aspect-[4/3] flex items-center justify-center`}
                >
                  <div
                    className={`${feature.bgColor} rounded-xl p-6 shadow-sm flex flex-col items-center gap-3`}
                  >
                    <span className={`${feature.color}`}>
                      {feature.icon}
                    </span>
                    <span className={`text-sm font-medium ${feature.color}`}>
                      {feature.headline}
                    </span>
                  </div>
                </div>
              </div>

              {/* Text content */}
              <div className="w-full lg:w-1/2">
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${feature.bgColor} ${feature.color} mb-4`}
                >
                  {feature.icon}
                  {feature.headline}
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
                  {feature.subheadline}
                </h2>
                <ul className="mt-6 space-y-3">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3">
                      <CheckCircle2
                        className={`h-5 w-5 mt-0.5 flex-shrink-0 ${feature.color}`}
                      />
                      <span className="text-gray-600 text-base leading-relaxed">
                        {bullet}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </section>

      {/* Bottom CTA */}
      <section className="bg-gray-900 px-6 py-20 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white">
          Start your free trial today
        </h2>
        <p className="mt-4 text-lg text-gray-400 max-w-xl mx-auto">
          No credit card required. Set up in minutes. Cancel any time.
        </p>
        <div className="mt-8">
          <Link
            href="/signup"
            className="inline-block bg-white text-gray-900 font-semibold text-base px-8 py-3.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Get started for free
          </Link>
        </div>
      </section>
    </div>
  );
}
