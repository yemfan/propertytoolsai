import { Redirect } from "expo-router";
import { ScreenLoading } from "../components/ScreenLoading";
import { useLeadsmartSession } from "../lib/session/LeadsmartSessionContext";

/**
 * Auth + onboarding gate: first-time users walk through `(onboarding)`;
 * signed-in users land on Home (dashboard).
 */
export default function Index() {
  const { ready, accessToken, onboardingComplete } = useLeadsmartSession();

  if (!ready) {
    return <ScreenLoading message="Starting…" />;
  }

  if (!onboardingComplete) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  if (!accessToken?.trim()) {
    return <Redirect href="/(onboarding)/login" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
