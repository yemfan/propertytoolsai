import { redirect } from "next/navigation";

/**
 * Seller presentations moved into the Listings page (Presentations
 * tab) — a listing presentation is how a listing gets won. Kept as a
 * redirect for old links; the client component still lives here and
 * is imported by the Listings tabs.
 */
export default function SellerPresentationPage() {
  redirect("/dashboard/properties?tab=presentations");
}
