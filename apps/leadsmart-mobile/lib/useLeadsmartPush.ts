import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { getLeadsmartAccessToken } from "./env";
import { registerMobileExpoPushToken } from "./leadsmartMobileApi";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const KINDS = new Set<string>([
  "hot_lead",
  "inbound_sms",
  "inbound_email",
  "needs_human",
  "reminder",
  "missed_call",
  "reminder_digest",
]);

function navigateFromPushData(
  router: ReturnType<typeof useRouter>,
  raw: Record<string, unknown>
) {
  const kind = typeof raw.kind === "string" ? raw.kind : "";
  const screen = typeof raw.screen === "string" ? raw.screen : "";
  const leadId = typeof raw.leadId === "string" ? raw.leadId : undefined;
  const taskId = typeof raw.taskId === "string" ? raw.taskId : undefined;

  if (screen === "notifications" || kind === "reminder_digest") {
    router.push("/notifications");
    return;
  }

  if (screen === "task" && taskId) {
    router.push({ pathname: "/tasks", params: { focusTaskId: taskId } });
    return;
  }

  if (screen === "call_log" && leadId) {
    router.push({ pathname: "/lead/[id]", params: { id: leadId } });
    return;
  }

  if (leadId && (screen === "lead" || screen === "" || !screen)) {
    router.push({ pathname: "/lead/[id]", params: { id: leadId } });
    return;
  }

  if (kind && KINDS.has(kind) && leadId) {
    router.push({ pathname: "/lead/[id]", params: { id: leadId } });
  }
}

/**
 * Registers the Expo push token with the LeadSmart AI API when JWT + API URL are set,
 * and routes when the user taps a notification.
 */
export function useLeadsmartPush() {
  const router = useRouter();
  const lastRegisteredToken = useRef<string | null>(null);
  const accessToken = getLeadsmartAccessToken();

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification?.request.content.data;
      if (data && typeof data === "object") {
        navigateFromPushData(router, data as Record<string, unknown>);
      }
    });
    return () => sub.remove();
  }, [router]);

  const openedFromNotification = useRef(false);
  useEffect(() => {
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (openedFromNotification.current) return;
      if (!response?.notification) return;
      openedFromNotification.current = true;
      const data = response.notification.request.content.data;
      if (data && typeof data === "object") {
        navigateFromPushData(router, data as Record<string, unknown>);
      }
    });
  }, [router]);

  useEffect(() => {
    if (!accessToken) {
      lastRegisteredToken.current = null;
      return;
    }
    if (!Device.isDevice) return;

    let cancelled = false;

    void (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted" || cancelled) return;

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "LeadSmart AI",
          importance: Notifications.AndroidImportance.HIGH,
        });
      }

      const projectId =
        (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
        Constants.easConfig?.projectId;

      const tokenResult = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId: String(projectId) } : undefined
      );
      if (cancelled || !tokenResult.data) return;

      if (lastRegisteredToken.current === tokenResult.data) return;
      lastRegisteredToken.current = tokenResult.data;

      const reg = await registerMobileExpoPushToken(tokenResult.data);
      if (reg.ok === false) {
        lastRegisteredToken.current = null;
        console.warn("[LeadSmart AI] push token registration failed:", reg.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);
}
