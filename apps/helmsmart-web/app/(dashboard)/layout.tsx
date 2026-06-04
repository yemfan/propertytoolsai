import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { getUnreadCount, getRecentNotifications } from "@/lib/actions/notifications";
import { NotificationsBell } from "@/components/notifications-bell";
import { HelmSmartAiPanel } from "@/components/helmsmart-ai-panel";
import { getActivePack } from "@/lib/packs";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("helmsmart-org-id")?.value ?? "";

  const supabase = await createClient();

  // Load notification data + current user email server-side
  const [unreadCount, notifications, { data: { user } }] = await Promise.all([
    getUnreadCount(orgId),
    getRecentNotifications(orgId, 20),
    supabase.auth.getUser(),
  ]);

  const pack = await getActivePack();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar
        unreadCount={unreadCount}
        userEmail={user?.email ?? null}
        avatarUrl={(user?.user_metadata?.avatar_url as string | undefined) ?? null}
        productName={pack.productName}
        logoLetter={pack.logoLetter}
        terms={pack.terms}
        notificationsSlot={
          <NotificationsBell
            orgId={orgId}
            initialCount={unreadCount}
            initialNotifications={notifications as Parameters<typeof NotificationsBell>[0]["initialNotifications"]}
          />
        }
      />
      <main id="main-content" className="flex-1 overflow-auto">
        {children}
      </main>
      {orgId ? <HelmSmartAiPanel productName={pack.productName} logoLetter={pack.logoLetter} /> : null}
    </div>
  );
}
