import type { Metadata } from "next";
import { NewOfferClient } from "./NewOfferClient";

export const metadata: Metadata = {
  title: "New Offer",
  robots: { index: false },
};

export default function NewOfferPage() {
  return <NewOfferClient />;
}
