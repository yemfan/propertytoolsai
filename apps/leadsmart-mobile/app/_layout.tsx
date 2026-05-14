import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { i18n, initI18n } from "../lib/i18n";
import { NetworkProvider } from "../lib/offline/NetworkContext";
import { LeadsmartSessionProvider } from "../lib/session/LeadsmartSessionContext";
import { useLeadsmartPush } from "../lib/useLeadsmartPush";

function RootNavigation() {
  useLeadsmartPush();

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: "#0f172a",
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="tasks" options={{ title: "Tasks" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
      <Stack.Screen name="lead/[id]" options={{ title: "Lead" }} />
    </Stack>
  );
}

export default function RootLayout() {
  // Block the first paint until i18next has resolved the stored
  // locale → otherwise the screen flashes English for a few frames
  // before snapping to the user's language on first render.
  const [i18nReady, setI18nReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void initI18n().then(() => {
      if (!cancelled) setI18nReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!i18nReady) return null;

  return (
    <I18nextProvider i18n={i18n}>
      <NetworkProvider>
        <LeadsmartSessionProvider>
          <RootNavigation />
        </LeadsmartSessionProvider>
      </NetworkProvider>
    </I18nextProvider>
  );
}
