import { Stack } from "expo-router";
import { useThemeTokens } from "../../lib/useThemeTokens";

/**
 * Onboarding stack — wired through `useThemeTokens()` so the
 * screen-transition background color follows the OS color
 * scheme. Previously `contentStyle.backgroundColor` was
 * hardcoded to `#f8fafc` (light slate-50), which flashed white
 * behind every slide animation on dark-mode devices — even
 * after the individual screens had learned to paint themselves
 * correctly via the `useOnboardingStyles()` hook.
 */
export default function OnboardingLayout() {
  const tokens = useThemeTokens();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: tokens.bg },
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="value" />
      <Stack.Screen name="login" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
