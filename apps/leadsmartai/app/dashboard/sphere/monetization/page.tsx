import { redirect } from "next/navigation";

/**
 * Sphere monetization moved into the Marketing Plans page (Sphere
 * tab) — nurturing and monetizing the sphere is the Marketing
 * Assistant's job. Kept as a redirect for old links; the seller/buyer
 * deep-dive views remain at /dashboard/sphere/likely-*.
 */
export default function SphereMonetizationPage() {
  redirect("/dashboard/marketing/plans?tab=sphere");
}
