import { Tabs } from "expo-router";
import { Platform, StatusBar } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeTokens, useIsDarkMode } from "../../lib/useThemeTokens";
import { hapticTabSwitch } from "../../lib/haptics";

/**
 * Bottom tab bar — batch-3 dark mode wiring.
 *
 * Previously this module held hardcoded brand/gray constants and
 * `#fff` backgrounds, so even when the rest of the app learned
 * to respect `useColorScheme()`, switching the phone to dark mode
 * left the tab bar and navigation header stuck in permanent light
 * mode. Now every color comes from `useThemeTokens()` so the
 * entire chrome follows the OS setting live.
 */
export default function TabsLayout() {
  const tokens = useThemeTokens();
  const isDark = useIsDarkMode();

  return (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <Tabs
        screenListeners={{
          // Light "selection changed" tick on every tab press.
          // Fires via React Navigation's tabPress event so both
          // the active and inactive presses get feedback (the
          // active tap feels like a "pop-to-top" acknowledgment).
          tabPress: () => {
            hapticTabSwitch();
          },
        }}
        screenOptions={{
          headerTitle: "LeadSmart AI",
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: tokens.surface,
            ...(Platform.OS === "ios"
              ? { borderBottomWidth: 0.5, borderBottomColor: tokens.border }
              : {}),
          },
          headerTitleStyle: {
            fontWeight: "700",
            fontSize: 18,
            color: tokens.text,
          },
          tabBarActiveTintColor: tokens.accent,
          tabBarInactiveTintColor: tokens.textSubtle,
          tabBarStyle: {
            backgroundColor: tokens.surface,
            borderTopColor: tokens.border,
            borderTopWidth: 0.5,
            paddingTop: 4,
            ...(Platform.OS === "ios" ? { height: 88 } : {}),
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Home",
            tabBarLabel: "Home",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="inbox"
          options={{
            title: "Inbox",
            tabBarLabel: "Inbox",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubble-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="leads"
          options={{
            title: "Leads",
            tabBarLabel: "Leads",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: "Calendar",
            tabBarLabel: "Calendar",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarLabel: "Settings",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
