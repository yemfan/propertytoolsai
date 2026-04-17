import Link from "next/link";
import type { SphereContactView } from "@/lib/sphere/types";
import type { TemplateWithOverride } from "@/lib/templates/types";
import {
  currencyFormat,
  percentFormat,
  relationshipLabel,
} from "@/lib/sphere/service";
import AddSignalButton from "./AddSignalButton";
import GenerateDraftButton from "./GenerateDraftButton";

/**
 * Read-only contact profile. Per-contact trigger toggles (sphere_contact_triggers)
 * will be wired in a follow-up once the trigger scheduler exists. For now this
 * renders the current state and flags triggers as "inherits agent default".
 */
export default function SphereContactProfile({
  contact,
  templates,
}: {
  contact: SphereContactView;
  templates: TemplateWithOverride[];
}) {
  const applicableTemplates = templates.filter(
    (t) =>
      t.category === "sphere" &&
      !t.variantOf &&
      isTemplateApplicable(t, contact),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link
        href="/dashboard/sphere"
        className="inline-flex text-sm font-medium text-gray-500 hover:text-gray-800"
      >
        ← Back to Sphere
      </Link>

      <header className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-start gap-4">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold text-white"
            style={{ background: contact.avatarColor }}
          >
            {contact.initials}
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-gray-900">{contact.fullName}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-gray-500">
              <span>{relationshipLabel(contact.relationshipType)}</span>
              {contact.relationshipTag && (
                <>
                  <span>·</span>
                  <span>{contact.relationshipTag}</span>
                </>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
              {contact.phone && <span>📞 {contact.phone}</span>}
              {contact.email && <span>✉️ {contact.email}</span>}
              {contact.preferredLanguage === "zh" && (
                <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px]">
                  Prefers 中文
                </span>
              )}
              {(contact.doNotContactSms || contact.doNotContactEmail) && (
                <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700">
                  Opted out {contact.doNotContactSms && "SMS"}{" "}
                  {contact.doNotContactEmail && "email"}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <EquityCard contact={contact} />
        <StatCard
          label="Last touch"
          value={
            contact.dormancyDays !== null ? `${contact.dormancyDays} days ago` : "Never"
          }
          hint={contact.lastTouchDate ? new Date(contact.lastTouchDate).toLocaleDateString() : undefined}
        />
        <StatCard
          label="Anniversary opt-in"
          value={contact.anniversaryOptIn ? "Yes" : "No"}
          hint={
            contact.anniversaryOptIn
              ? "Anniversary trigger can fire"
              : "Required before anniversary trigger fires per spec §2.8"
          }
        />
      </section>

      <section
        className={`rounded-xl border p-5 ${
          contact.signals.length > 0
            ? "border-amber-200 bg-amber-50"
            : "border-gray-200 bg-white"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2
              className={`text-sm font-semibold ${
                contact.signals.length > 0 ? "text-amber-900" : "text-gray-900"
              }`}
            >
              Open signals
            </h2>
            <p
              className={`mt-0.5 text-xs ${
                contact.signals.length > 0 ? "text-amber-800" : "text-gray-500"
              }`}
            >
              Per spec §2.6.3 — never auto-send. Treat as a calling list.
            </p>
          </div>
          <AddSignalButton contactId={contact.id} />
        </div>
        {contact.signals.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {contact.signals.map((s) => (
              <li key={s.id} className="rounded-lg border border-amber-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900">{s.label}</span>
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                    {s.confidence}
                  </span>
                </div>
                {s.suggestedAction && (
                  <div className="mt-1 text-xs text-gray-600">{s.suggestedAction}</div>
                )}
                <div className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">
                  Detected {new Date(s.detectedAt).toLocaleDateString()}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-gray-500">
            No open signals for this contact.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Upcoming triggers</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Sphere templates applicable to this contact. Per-contact toggles are planned but not wired yet —
          state currently inherits from the agent default.
        </p>
        <ul className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
          {applicableTemplates.length === 0 ? (
            <li className="p-6 text-center text-sm text-gray-400">
              No templates available for this contact. Seed the library first.
            </li>
          ) : (
            applicableTemplates.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-gray-400">{t.id}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        t.channel === "sms"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-violet-50 text-violet-700"
                      }`}
                    >
                      {t.channel}
                    </span>
                  </div>
                  <div className="mt-0.5 text-sm font-medium text-gray-900">{t.name}</div>
                  {t.notes && (
                    <div className="mt-0.5 text-[11px] text-gray-500 italic">{t.notes}</div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-gray-500">
                    Inherits: {t.effectiveStatus}
                  </span>
                  <GenerateDraftButton contactId={contact.id} templateId={t.id} />
                  <Link
                    href={`/dashboard/templates#${t.id}`}
                    className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-50"
                  >
                    Edit template
                  </Link>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5">
        <h2 className="text-sm font-semibold text-gray-700">Timeline</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Per-contact message history lands here once the send log integration is wired. Pulls from{" "}
          <code className="font-mono">communications</code> scoped to this contact.
        </p>
      </section>
    </div>
  );
}

function EquityCard({ contact }: { contact: SphereContactView }) {
  if (
    contact.avmCurrent === null ||
    contact.closingPrice === null ||
    contact.equityDelta === null
  ) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          Equity
        </div>
        <div className="mt-1 text-sm text-gray-500">
          No closing or AVM on file. Equity triggers require both.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Equity</div>
        <div className="text-[10px] uppercase tracking-wide text-gray-400">
          AVM {contact.avmUpdatedAt ? new Date(contact.avmUpdatedAt).toLocaleDateString() : ""}
        </div>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-gray-900 tabular-nums">
          {currencyFormat(contact.avmCurrent)}
        </span>
        <span className="text-sm text-emerald-700">
          +{percentFormat(contact.equityPct)}
        </span>
      </div>
      <div className="mt-1 text-xs text-gray-500">
        Paid {currencyFormat(contact.closingPrice)} · equity {currencyFormat(contact.equityDelta)}
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}

function isTemplateApplicable(t: TemplateWithOverride, c: SphereContactView): boolean {
  // Rough spec §2.8 agent-of-record check. Real scheduler must do a strict match
  // on the specific property — this is just a UI filter to avoid showing templates
  // that could never fire for this contact.
  if (t.id.startsWith("EQ") || t.id.startsWith("EM") || t.id.startsWith("HA")) {
    return (
      c.relationshipType === "past_buyer_client" ||
      c.relationshipType === "past_seller_client"
    );
  }
  return true;
}
