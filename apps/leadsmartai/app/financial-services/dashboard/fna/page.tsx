import type { Metadata } from "next";
import FnaGeneratorClient from "./FnaGeneratorClient";

export const metadata: Metadata = {
  title: "Financial Needs Analysis · LeadSmart AI",
  robots: { index: false },
};

export default function FnaGeneratorPage() {
  return <FnaGeneratorClient />;
}
