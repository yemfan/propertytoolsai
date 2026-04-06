import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentAgentContext } from "@/lib/dashboardService";
import SellerPresentationClient from "./SellerPresentationClient";

export const metadata = {
  title: "Seller Presentation | LeadSmart AI",
  description: "Generate AI-powered seller presentations with property comparisons.",
};

export default async function SellerPresentationPage() {
  await getCurrentAgentContext();

  const { data: properties } = await supabaseServer
    .from("properties_warehouse")
    .select("id, address, city, state, beds, baths, sqft, property_type, year_built")
    .order("updated_at", { ascending: false })
    .limit(100);

  return (
    <SellerPresentationClient
      properties={(properties ?? []) as Array<Record<string, unknown>>}
    />
  );
}
