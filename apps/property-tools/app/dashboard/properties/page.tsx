import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";

type PropertyRow = {
  id: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  property_type: string | null;
  created_at?: string;
  updated_at?: string;
};

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const sp = searchParams != null ? await searchParams : {};
  const q = (sp.q ?? "").trim();

  let query = supabaseServer
    .from("properties_warehouse")
    .select("id,address,city,state,zip_code,beds,baths,sqft,property_type,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (q) {
    query = supabaseServer
      .from("properties_warehouse")
      .select("id,address,city,state,zip_code,beds,baths,sqft,property_type,created_at,updated_at")
      .ilike("address", `%${q}%`)
      .order("updated_at", { ascending: false })
      .limit(100);
  }

  const { data, error } = await query;

  const properties = (data ?? []) as PropertyRow[];

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Properties</h1>
          <p className="text-sm text-slate-600">Search your imported properties and run tools instantly.</p>
        </div>
        <form method="get" className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by address"
            className="w-full md:w-72 border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="rounded-xl bg-blue-600 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-700"
          >
            Search
          </button>
        </form>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          Failed to load properties.
        </div>
      ) : null}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Address</th>
                <th className="text-left px-4 py-3 font-semibold">Beds</th>
                <th className="text-left px-4 py-3 font-semibold">Baths</th>
                <th className="text-left px-4 py-3 font-semibold">Sqft</th>
                <th className="text-left px-4 py-3 font-semibold">Type</th>
                <th className="text-left px-4 py-3 font-semibold">Tools</th>
              </tr>
            </thead>
            <tbody>
              {properties.length ? (
                properties.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{p.address ?? "—"}</div>
                      <div className="text-xs text-slate-600">
                        {[p.city, p.state, p.zip_code].filter(Boolean).join(", ")}
                      </div>
                    </td>
                    <td className="px-4 py-3">{p.beds ?? "—"}</td>
                    <td className="px-4 py-3">{p.baths ?? "—"}</td>
                    <td className="px-4 py-3">{p.sqft != null ? Number(p.sqft).toLocaleString() : "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{p.property_type ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <Link
                          href={`/home-value-estimator?address=${encodeURIComponent(p.address ?? "")}`}
                          className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                        >
                          Estimator
                        </Link>
                        <Link
                          href={`/smart-cma-builder?address=${encodeURIComponent(p.address ?? "")}`}
                          className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                        >
                          CMA
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-sm text-slate-600">
                    No properties found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

