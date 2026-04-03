import { Stack } from "expo-router";
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
  return (
    <LeadsmartSessionProvider>
      <RootNavigation />
    </LeadsmartSessionProvider>
  );
}
