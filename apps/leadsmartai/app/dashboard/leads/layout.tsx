import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return {
    title: t("leads_legacy_metadata.title", { ns: "web_contacts" }),
    description: t("leads_legacy_metadata.description", { ns: "web_contacts" }),
    keywords: ["leads", "CRM", "pipeline", "follow-ups"],
    robots: { index: false },
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
