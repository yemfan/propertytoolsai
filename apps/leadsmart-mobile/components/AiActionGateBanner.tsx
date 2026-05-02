import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { getLeadsmartApiBaseUrl } from "../lib/env";
import type { AiActionGateReason } from "../lib/aiActionGate";

/**
 * Mobile mirror of `apps/leadsmartai/components/entitlements/AiActionGateBanner.tsx`.
 *
 * Renders when an AI endpoint returns HTTP 402 with a known
 * entitlement code. Tells the agent what's blocked + opens the web
 * billing page via `Linking` (we don't have a native plan-selector
 * screen yet; web has the full Stripe portal). The URL is built from
 * the configured `EXPO_PUBLIC_LEADSMART_API_URL` so it points at the
 * right environment.
 *
 * Uses a fixed amber palette (not theme tokens) so the upgrade
 * affordance stands out against any background — same intent as the
 * web banner.
 */
export function AiActionGateBanner({
  reason,
}: {
  reason: AiActionGateReason;
}) {
  const isLimit = reason === "ai_usage_limit_reached";
  const title = isLimit
    ? "You've hit your AI limit for this period"
    : "AI actions aren't on your plan yet";
  const body = isLimit
    ? "Your current plan caps how many AI drafts run each month. Upgrade for a higher limit, or wait until next period."
    : "AI-drafted replies run on a paid plan. Pick a plan to turn this on for your workspace.";

  const onUpgrade = () => {
    const base = getLeadsmartApiBaseUrl();
    const url = base
      ? `${base}/dashboard/billing`
      : "https://leadsmart-ai.com/dashboard/billing";
    void Linking.openURL(url);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <Pressable
        style={styles.cta}
        onPress={onUpgrade}
        accessibilityRole="button"
        accessibilityLabel={isLimit ? "View plans and upgrade" : "Choose a plan"}
      >
        <Text style={styles.ctaText}>
          {isLimit ? "View plans & upgrade" : "Choose a plan"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FCD34D",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  title: { fontSize: 13, fontWeight: "700", color: "#78350F" },
  body: { marginTop: 2, fontSize: 12, lineHeight: 16, color: "#92400E" },
  cta: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "#78350F",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ctaText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
});
