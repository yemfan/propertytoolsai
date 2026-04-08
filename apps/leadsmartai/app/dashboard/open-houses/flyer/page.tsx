import FlyerBuilderClient from "./FlyerBuilderClient";

export const metadata = {
  title: "Open House Flyer Builder | LeadSmart AI",
  description: "Create a professional open house flyer with property details, photos, and QR code.",
};

export default function FlyerBuilderPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <FlyerBuilderClient />
    </div>
  );
}
