import { redirect } from "next/navigation";

/**
 * Sphere is now a Smart List on /dashboard/contacts. Redirect top-level
 * /dashboard/sphere to the contacts hub; users click the Sphere tab there.
 *
 * Sub-routes still resolve for now:
 *   /dashboard/sphere/[contactId] — contact profile (also reachable via
 *     /dashboard/contacts/[contactId] once that route lands)
 *   /dashboard/sphere/import      — CSV import UI (will move to
 *     /dashboard/contacts/import in a cleanup pass)
 *   /dashboard/sphere/signals     — life-event signal list
 */
export default function LegacySpherePage() {
  redirect("/dashboard/contacts");
}
