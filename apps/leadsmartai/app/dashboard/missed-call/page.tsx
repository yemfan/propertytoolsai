import type { Metadata } from "next";
import MissedCallPageClient from "./MissedCallPageClient";

export const metadata: Metadata = {
  title: "Missed-call text-back",
  description:
    "Review every recent call and the auto-text that went out, with one-click access to your forwarding settings, message template, and AI personalization toggle.",
  robots: { index: false },
};

/**
 * Activity-first dashboard surface for missed-call text-back.
 *
 * The page renders MissedCallPageClient which puts the call log front
 * and center; settings live behind a "Settings" button that expands a
 * collapsible panel inline. The legacy MissedCallSettingsPanel is
 * still mounted on /dashboard/settings → Voice tab for agents who go
 * to settings expecting to find it there.
 */
export default function MissedCallPage() {
  return <MissedCallPageClient />;
}
