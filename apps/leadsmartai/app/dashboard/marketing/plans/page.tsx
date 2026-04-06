import MarketingPlansClient from "./MarketingPlansClient";

export const metadata = {
  title: "Marketing Plans | LeadSmart AI",
  description: "Create, customize, and manage automated marketing plans for your leads.",
};

export default function MarketingPlansPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <MarketingPlansClient />
    </div>
  );
}
