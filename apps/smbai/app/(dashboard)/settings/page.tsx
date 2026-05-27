import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { OrgSettingsForm } from "@/components/org-settings-form";
import { BankAccountMappingForm } from "@/components/bank-account-mapping-form";
import { Users, ChevronRight } from "lucide-react";

export const metadata: Metadata = { title: "Settings" };

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value ?? "";
  const supabase = await createClient();

  const [{ data: org }, { data: bankAccounts }, { data: coaAccounts }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, entity_type, accounting_basis, currency, timezone, fiscal_year_end_month, plan, subscription_status, trial_ends_at")
      .eq("id", orgId)
      .single(),
    supabase
      .from("bank_accounts")
      .select("id, name, type, subtype, mask, coa_account_id, institution:bank_connections(institution_name)")
      .eq("organization_id", orgId)
      .eq("is_active", true),
    supabase
      .from("chart_of_accounts")
      .select("id, code, name, type")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .in("type", ["asset", "liability"])
      .order("code"),
  ]);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your organization and integrations.</p>
      </div>

      <div className="space-y-8">
        {/* Org info */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-200">
            Business information
          </h2>
          <OrgSettingsForm
            org={org}
            timezones={TIMEZONES}
            months={MONTHS}
          />
        </section>

        {/* Bank account → CoA mapping */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-1 pb-2 border-b border-slate-200">
            Bank account mapping
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Link each bank account to a chart of accounts entry. This is required for transactions
            to be posted to the double-entry journal automatically.
          </p>
          {bankAccounts?.length ? (
            <div className="space-y-3">
              {bankAccounts.map((ba) => (
                <BankAccountMappingForm
                  key={ba.id}
                  bankAccount={ba}
                  coaAccounts={coaAccounts ?? []}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
              No bank accounts linked yet. Connect a bank from the{" "}
              <a href="/books" className="text-indigo-600 hover:underline">Books</a> page.
            </div>
          )}
        </section>

        {/* Integrations & webhooks */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-1 pb-2 border-b border-slate-200">
            Integrations & webhooks
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Configure these in your service dashboards so external events reach your app.
          </p>
          <div className="space-y-4">
            {/* Stripe */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-700 mb-3">Stripe</p>
              <div className="space-y-2">
                {[
                  { label: "Webhook endpoint", path: "/api/stripe/webhook", note: "Events: checkout.session.completed" },
                ].map(({ label, path, note }) => (
                  <div key={path}>
                    <p className="text-xs text-slate-500 mb-1">{label}</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-indigo-700 font-mono truncate">
                        {process.env.NEXT_PUBLIC_APP_URL}{path}
                      </code>
                    </div>
                    {note && <p className="text-[11px] text-slate-400 mt-1">{note}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Twilio */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-700 mb-3">Twilio</p>
              <div className="space-y-2">
                {[
                  { label: "Voice — A call comes in", path: "/api/twilio/voice" },
                  { label: "Messaging — A message comes in", path: "/api/twilio/sms" },
                ].map(({ label, path }) => (
                  <div key={path}>
                    <p className="text-xs text-slate-500 mb-1">{label}</p>
                    <code className="block text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-indigo-700 font-mono truncate">
                      {process.env.NEXT_PUBLIC_APP_URL}{path}
                    </code>
                  </div>
                ))}
              </div>
            </div>

            {/* Vercel Cron */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-700 mb-1">Vercel Cron</p>
              <p className="text-xs text-slate-500 mt-0.5 mb-2">
                Set <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">CRON_SECRET</code> in your Vercel environment variables to secure the cron endpoint.
                The overdue invoice cron runs daily at 09:00 UTC.
              </p>
              <code className="block text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600 font-mono">
                GET {process.env.NEXT_PUBLIC_APP_URL}/api/cron/invoices/overdue
              </code>
            </div>
          </div>
        </section>

        {/* Team */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-200">
            Team
          </h2>
          <Link
            href="/settings/team"
            className="flex items-center justify-between bg-slate-50 rounded-xl border border-slate-200 p-5 hover:bg-white hover:border-slate-300 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Manage team members</p>
                <p className="text-xs text-slate-500 mt-0.5">Invite colleagues, set roles, revoke access</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </Link>
        </section>

        {/* Plan info */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-200">
            Plan & billing
          </h2>
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800 capitalize">
                  {org?.plan ?? "Starter"} plan
                </p>
                <p className="text-xs text-slate-500 mt-0.5 capitalize">
                  {org?.subscription_status ?? "trialing"}
                  {org?.trial_ends_at && (
                    <> · Trial ends {new Date(org.trial_ends_at).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</>
                  )}
                </p>
              </div>
              <span className="inline-block px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded-full">
                Free during beta
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
