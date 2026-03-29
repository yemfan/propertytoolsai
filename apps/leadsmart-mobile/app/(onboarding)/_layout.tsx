import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: "#f8fafc" },
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="value" />
      <Stack.Screen name="login" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
