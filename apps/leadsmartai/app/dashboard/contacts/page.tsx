import { ContactHealthPanel } from "@/components/crm/ContactHealthPanel";
import { DuplicateReviewPanel } from "@/components/crm/DuplicateReviewPanel";
import { EnrichmentQueuePanel } from "@/components/crm/EnrichmentQueuePanel";
import { getContacts } from "@/lib/dashboardService";
import { fetchUserPortalContext } from "@/lib/rolePortalServer";
import { supabaseServerClient } from "@/lib/supabaseServerClient";

export default async function ContactsPage() {
  const contacts = await getContacts(500);
  const supabase = supabaseServerClient();
  const ctx = await fetchUserPortalContext(supabase);
  const isAdmin = String(ctx?.role ?? "").toLowerCase() === "admin";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
        <p className="text-sm text-gray-600">View and manage your contacts.</p>
      </div>

      <ContactHealthPanel />
      <div className="grid gap-4 lg:grid-cols-2">
        <DuplicateReviewPanel isAdmin={isAdmin} />
        <EnrichmentQueuePanel isAdmin={isAdmin} />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Name</th>
                <th className="text-left px-4 py-3 font-semibold">Email</th>
                <th className="text-left px-4 py-3 font-semibold">Phone</th>
                <th className="text-left px-4 py-3 font-semibold">Address</th>
                <th className="text-left px-4 py-3 font-semibold">Type</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-3">{c.name ?? "—"}</td>
                  <td className="px-4 py-3">{c.email ?? "—"}</td>
                  <td className="px-4 py-3">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3">{c.address ?? "—"}</td>
                  <td className="px-4 py-3">{c.type ?? "—"}</td>
                </tr>
              ))}
              {!contacts.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-gray-600">
                    No contacts yet.
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

