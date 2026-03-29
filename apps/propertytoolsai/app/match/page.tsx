import { SmartMatch } from "@/components/match/SmartMatch";

export const metadata = {
  title: "Smart property match | PropertyToolsAI",
  description: "AI-ranked homes based on your budget, lifestyle, and timeline — not just filters.",
};

export default function SmartMatchPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <SmartMatch />
    </div>
  );
}
