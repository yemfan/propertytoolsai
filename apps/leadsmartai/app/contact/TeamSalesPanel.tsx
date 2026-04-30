import { CalendarDays, Mail, ArrowDown } from "lucide-react";

/**
 * High-touch sales surface shown above /contact's form when the
 * inbound came from the Team-tier CTA on the landing page
 * (`/contact?topic=team`).
 *
 * Anyone clicking through to this state has already signaled they're
 * a brokerage / multi-seat buyer, so the form is the wrong default —
 * a 20-min booked call closes faster than a string of emails. We
 * surface the calendar and a direct mailto first; the form remains
 * available below as a fallback for buyers who'd rather type.
 *
 * Configuration:
 *   - `SALES_CAL_URL` (server env) — booking URL (Cal.com, Calendly,
 *     Google Calendar appointments, etc.). When unset, the calendar
 *     card is omitted and the email/form remain.
 *
 * The component is a server component because the URL is read once
 * at request time and never changes per session.
 */
export default function TeamSalesPanel() {
  const calendarUrl = process.env.SALES_CAL_URL?.trim() || null;
  const subject = "Team plan inquiry — more than 5 seats";
  const body =
    "Hi LeadSmart team,\n\n" +
    "I'm interested in the Team plan for my brokerage. We have ___ agents " +
    "and would like to learn more about pricing, onboarding, and the Top " +
    "Producer Track for the whole team.\n\n";
  const mailto = `mailto:contact@leadsmart-ai.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="mb-10 rounded-2xl border border-[#0072ce]/20 bg-gradient-to-br from-[#0072ce]/5 via-white to-white p-6 shadow-sm sm:p-8">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0072ce]">
          Talk to sales
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">
          Looking at the Team plan?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600 sm:text-base">
          Brokerages and multi-seat teams typically close faster on a quick call
          than over email. Pick whichever path works.
        </p>
      </div>

      <div className={`mt-6 grid gap-4 ${calendarUrl ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
        {calendarUrl ? (
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3 rounded-xl border border-[#0072ce]/30 bg-white p-5 shadow-sm transition hover:border-[#0072ce] hover:shadow-md"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0072ce]/10 text-[#0072ce]">
              <CalendarDays className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-[#0072ce]">
                Book a 20-min sales call
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Pick a slot — pricing, onboarding, and demo.
              </p>
              <span className="mt-2 inline-block text-xs font-semibold text-[#0072ce] group-hover:underline">
                Open calendar →
              </span>
            </div>
          </a>
        ) : null}

        <a
          href={mailto}
          className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#0072ce] hover:shadow-md"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <Mail className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 group-hover:text-[#0072ce]">
              Email sales directly
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 break-all">
              contact@leadsmart-ai.com
            </p>
            <span className="mt-2 inline-block text-xs font-semibold text-[#0072ce] group-hover:underline">
              Compose with subject pre-filled →
            </span>
          </div>
        </a>
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-500">
        <ArrowDown className="h-3 w-3" strokeWidth={2.5} />
        Or fill out the form below
      </p>
    </div>
  );
}
