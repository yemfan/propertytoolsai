import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useLeadsmartSession } from "../../lib/session/LeadsmartSessionContext";
import {
  fetchMobileNotificationPreferences,
  patchMobileNotificationPreferences,
} from "../../lib/leadsmartMobileApi";
import { getSupabaseAuthClient } from "../../lib/supabaseAuthClient";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const { signOut } = useLeadsmartSession();
  const [email, setEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [pushHot, setPushHot] = useState(true);
  const [pushMissed, setPushMissed] = useState(true);
  const [pushReminder, setPushReminder] = useState(true);
  const [digestMin, setDigestMin] = useState(15);

  useEffect(() => {
    const sb = getSupabaseAuthClient();
    if (!sb) return;
    void sb.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null);
    });
  }, []);

  useEffect(() => {
    void (async () => {
      setPrefsLoading(true);
      const res = await fetchMobileNotificationPreferences();
      setPrefsLoading(false);
      if (res.ok === false) return;
      setPushHot(res.preferences.push_hot_lead);
      setPushMissed(res.preferences.push_missed_call);
      setPushReminder(res.preferences.push_reminder);
      setDigestMin(res.preferences.reminder_digest_minutes);
    })();
  }, []);

  const savePrefs = useCallback(
    async (patch: {
      push_hot_lead?: boolean;
      push_missed_call?: boolean;
      push_reminder?: boolean;
      reminder_digest_minutes?: number;
    }) => {
      setPrefsSaving(true);
      const res = await patchMobileNotificationPreferences(patch);
      setPrefsSaving(false);
      if (res.ok === false) return;
      setPushHot(res.preferences.push_hot_lead);
      setPushMissed(res.preferences.push_missed_call);
      setPushReminder(res.preferences.push_reminder);
      setDigestMin(res.preferences.reminder_digest_minutes);
    },
    []
  );

  const onSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/(onboarding)/login");
    } finally {
      setSigningOut(false);
    }
  }, [router, signOut]);

  const version = Constants.expoConfig?.version ?? "—";

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Settings</Text>
      <Text style={styles.sub}>Account and preferences</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.email}>{email ?? "—"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Push notifications</Text>
        <Text style={styles.hint}>
          Hot leads send immediately. Reminders are batched on the server to reduce noise.
        </Text>
        {prefsLoading ? (
          <ActivityIndicator style={styles.prefsSpinner} color={tokens.accent} />
        ) : (
          <>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Hot leads (high priority)</Text>
              <Switch
                value={pushHot}
                onValueChange={(v) => {
                  setPushHot(v);
                  void savePrefs({ push_hot_lead: v });
                }}
                disabled={prefsSaving}
              />
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Missed calls</Text>
              <Switch
                value={pushMissed}
                onValueChange={(v) => {
                  setPushMissed(v);
                  void savePrefs({ push_missed_call: v });
                }}
                disabled={prefsSaving}
              />
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Follow-up reminders (batched)</Text>
              <Switch
                value={pushReminder}
                onValueChange={(v) => {
                  setPushReminder(v);
                  void savePrefs({ push_reminder: v });
                }}
                disabled={prefsSaving}
              />
            </View>
            <Text style={styles.digestNote}>
              Digest window: {digestMin} min (server-side; contact support to tune).
            </Text>
          </>
        )}
      </View>

      <Pressable
        onPress={() => router.push("/notifications")}
        style={({ pressed }) => [styles.secondaryBtn, pressed && styles.secondaryBtnPressed]}
        accessibilityRole="button"
        accessibilityLabel="Open notification center"
      >
        <Text style={styles.secondaryBtnText}>Notification center</Text>
      </Pressable>

      {/*
       * Re-entry path back into the onboarding walkthrough. Users
       * who swiped past the value slides on their first launch had
       * no way to see them again — this button lets them revisit
       * the "why LeadSmart" pitch and notification permissions.
       * It enters the onboarding stack at the value screen (not
       * welcome), which avoids the "Get started" CTA repeating
       * while still showing the back button.
       */}
      <Pressable
        onPress={() => router.push("/(onboarding)/value")}
        style={({ pressed }) => [styles.secondaryBtn, pressed && styles.secondaryBtnPressed]}
        accessibilityRole="button"
        accessibilityLabel="Replay onboarding walkthrough"
        accessibilityHint="Shows the app intro and notification setup again"
      >
        <Text style={styles.secondaryBtnText}>Replay onboarding</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.label}>App</Text>
        <Text style={styles.meta}>LeadSmart AI · v{version}</Text>
      </View>

      <Pressable
        onPress={() => void onSignOut()}
        disabled={signingOut}
        style={({ pressed }) => [styles.signOut, pressed && styles.signOutPressed]}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        {signingOut ? (
          <ActivityIndicator color={tokens.textOnAccent} />
        ) : (
          <Text style={styles.signOutText}>Sign out</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

/**
 * Style factory — consumed via `useMemo` inside `SettingsScreen`
 * so the StyleSheet rebuilds when the OS color scheme flips.
 */
const createStyles = (theme: ThemeTokens) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingBottom: 40 },
  h1: { fontSize: 28, fontWeight: "700", color: theme.text },
  sub: { marginTop: 6, fontSize: 15, color: theme.textMuted },
  card: {
    marginTop: 20,
    backgroundColor: theme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: theme.textSubtle,
    marginBottom: 8,
  },
  hint: { fontSize: 13, color: theme.textMuted, lineHeight: 18, marginBottom: 12 },
  email: { fontSize: 16, fontWeight: "600", color: theme.text },
  meta: { fontSize: 15, color: theme.textMuted },
  prefsSpinner: { marginVertical: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 12,
  },
  rowLabel: { flex: 1, fontSize: 15, color: theme.text, fontWeight: "600" },
  digestNote: { fontSize: 12, color: theme.textSubtle, marginTop: 4 },
  secondaryBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    alignItems: "center",
  },
  secondaryBtnPressed: { opacity: 0.9 },
  secondaryBtnText: { fontSize: 16, fontWeight: "700", color: theme.accent },
  signOut: {
    marginTop: 28,
    backgroundColor: theme.danger,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  signOutPressed: { opacity: 0.9 },
  signOutText: { color: theme.textOnAccent, fontSize: 16, fontWeight: "700" },
});
