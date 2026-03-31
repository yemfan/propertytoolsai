import type { MobilePushNotificationKind } from "@leadsmart/shared";
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

function parsePushData(data: Record<string, unknown>): { leadId: string; kind: MobilePushNotificationKind } | null {
  const leadId = typeof data.leadId === "string" ? data.leadId : null;
  const kind = typeof data.kind === "string" ? data.kind : null;
  if (!leadId || !kind) return null;
  if (
    kind !== "hot_lead" &&
    kind !== "inbound_sms" &&
    kind !== "inbound_email" &&
    kind !== "needs_human"
  ) {
    return null;
  }
  return { leadId, kind };
}

function navigateToLead(
  router: ReturnType<typeof useRouter>,
  data: Record<string, unknown> | undefined
) {
  if (!data || typeof data !== "object") return;
  const parsed = parsePushData(data as Record<string, unknown>);
  if (!parsed) return;
  router.push({ pathname: "/lead/[id]", params: { id: parsed.leadId } });
}

/**
 * Registers the Expo push token with the LeadSmart AI API when JWT + API URL are set,
 * and opens the lead screen when the user taps a notification.
 */
export function useLeadsmartPush() {
  const router = useRouter();
  const lastRegisteredToken = useRef<string | null>(null);
  const accessToken = getLeadsmartAccessToken();

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateToLead(router, response.notification?.request.content.data);
    });
    return () => sub.remove();
  }, [router]);

  const openedFromNotification = useRef(false);
  useEffect(() => {
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (openedFromNotification.current) return;
      if (!response?.notification) return;
      openedFromNotification.current = true;
      navigateToLead(router, response.notification.request.content.data);
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
