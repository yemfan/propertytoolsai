import { ImportWizardClient } from "./ImportWizardClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Import Leads",
  description: "Bulk import leads from CSV or other sources.",
  keywords: ["import leads", "CSV import", "bulk upload"],
  robots: { index: false },
};

export default function LeadImportPage() {
  return <ImportWizardClient />;
}
