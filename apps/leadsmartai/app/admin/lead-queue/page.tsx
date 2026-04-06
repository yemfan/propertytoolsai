import { AdminLeadQueueClient } from "./AdminLeadQueueClient";

export const metadata = {
  title: "Lead Queue | Admin | LeadSmart AI",
  description: "Assign queued leads to agents.",
};

export default function AdminLeadQueuePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <AdminLeadQueueClient />
    </div>
  );
}
