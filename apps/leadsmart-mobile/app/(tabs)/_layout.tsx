import { Tabs } from "expo-router";
import { Platform } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

const BRAND_BLUE = "#0072ce";
const INACTIVE_GRAY = "#94a3b8";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerTitle: "LeadSmart AI",
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: "#fff",
          ...(Platform.OS === "ios" ? { borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" } : {}),
        },
        headerTitleStyle: {
          fontWeight: "700",
          fontSize: 18,
          color: "#0f172a",
        },
        tabBarActiveTintColor: BRAND_BLUE,
        tabBarInactiveTintColor: INACTIVE_GRAY,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#e2e8f0",
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
  );
}
