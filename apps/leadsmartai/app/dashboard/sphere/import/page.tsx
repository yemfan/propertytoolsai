import type { Metadata } from "next";
import SphereImportClient from "@/components/dashboard/SphereImportClient";

export const metadata: Metadata = {
  title: "Import Sphere contacts",
  robots: { index: false },
};

export default function SphereImportPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <SphereImportClient />
    </div>
  );
}
