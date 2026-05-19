import type { Metadata } from "next";
import TemplatesClient from "./TemplatesClient";

export const metadata: Metadata = {
  title: "Templates · LeadSmart AI",
  robots: { index: false },
};

export default function TemplatesPage() {
  return <TemplatesClient />;
}
