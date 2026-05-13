import type { Metadata } from "next";
import Link from "next/link";

import RecurringListClient from "./RecurringListClient";

export const metadata: Metadata = {
  title: "Recurring Posts | LeadSmart AI",
  description:
    "Manage your daily and weekly recurring social posts.",
  robots: { index: false },
};

/**
 * Phase 2D management page for recurring post schedules. The list
 * itself is fetched client-side so pause/resume/cancel can mutate
 * without a server-render dance — same pattern as the scheduled
 * posts page.
 */
export default function RecurringPostsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Recurring posts
          </h1>
          <p className="text-sm text-gray-500">
            Daily and weekly templates the cron materializes into
            scheduled posts automatically.
          </p>
        </div>
        <Link
          href="/dashboard/leads/generate"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          &larr; Back
        </Link>
      </div>
      <RecurringListClient />
    </div>
  );
}
