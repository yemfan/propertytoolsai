import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { GlobalSearch } from "@/components/global-search";
import { getUnreadCount, getRecentNotifications } from "@/lib/actions/notifications";
import { NotificationsBell } from "@/components/notifications-bell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("smbai-org-id")?.value ?? "";

  const supabase = await createClient();

  // Load notification data + current user email server-side
  const [unreadCount, notifications, { data: { user } }] = await Promise.all([
    getUnreadCount(orgId),
    getRecentNotifications(orgId, 20),
    supabase.auth.getUser(),
  ]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar
        unreadCount={unreadCount}
        userEmail={user?.email ?? null}
        notificationsSlot={
          <NotificationsBell
            orgId={orgId}
            initialCount={unreadCount}
            initialNotifications={notifications as Parameters<typeof NotificationsBell>[0]["initialNotifications"]}
          />
        }
        searchSlot={<GlobalSearch />}
      />
      <main id="main-content" className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
