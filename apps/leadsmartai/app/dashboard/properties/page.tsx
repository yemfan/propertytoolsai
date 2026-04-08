import { supabaseServer } from "@/lib/supabaseServer";
import PropertiesClient from "./PropertiesClient";

export default async function PropertiesPage() {
  const { data } = await supabaseServer
    .from("properties_warehouse")
    .select("id, address, city, state, zip_code, beds, baths, sqft, property_type, year_built")
    .order("updated_at", { ascending: false })
    .limit(200);

  return <PropertiesClient properties={(data ?? []) as any[]} />;
}
