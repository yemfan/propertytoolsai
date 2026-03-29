import { redirect } from "next/navigation";

/** Canonical consumer pricing lives at `/pricing`. */
export default function PricingConsumerRedirectPage() {
  redirect("/pricing");
}
