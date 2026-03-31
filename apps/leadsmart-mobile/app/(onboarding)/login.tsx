import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { getLeadsmartApiBaseUrl } from "../../lib/env";
import { onboardingStyles as s } from "../../lib/onboarding/styles";
import { useLeadsmartSession } from "../../lib/session/LeadsmartSessionContext";

export default function OnboardingLoginScreen() {
  const router = useRouter();
  const { signInWithToken, onboardingComplete } = useLeadsmartSession();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = getLeadsmartApiBaseUrl();

  const onSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithToken(token);
      if (onboardingComplete) {
        router.replace("/(tabs)/inbox");
      } else {
        router.replace("/(onboarding)/notifications");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.safePad}>
        <View style={s.centerBlock}>
          <Text style={s.kicker}>Sign in</Text>
          <Text style={s.title}>Connect your account</Text>
          <Text style={s.body}>
            Paste the same Supabase JWT you use with LeadSmart AI web (Bearer token for mobile API). Your API
            base URL must be set in{" "}
            <Text style={{ fontWeight: "700" }}>EXPO_PUBLIC_LEADSMART_API_URL</Text>.
          </Text>
          {!apiUrl ? (
            <Text style={s.error}>Missing API URL — set EXPO_PUBLIC_LEADSMART_API_URL in .env or app config.</Text>
          ) : (
            <Text style={s.muted} numberOfLines={2}>
              Endpoint: {apiUrl}
            </Text>
          )}
          <TextInput
            style={s.input}
            placeholder="Paste JWT access token"
            placeholderTextColor="#94a3b8"
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            editable={!busy}
            accessibilityLabel="Access token"
          />
          {error ? <Text style={s.error}>{error}</Text> : null}
        </View>
        <View>
          <Pressable
            style={[s.primaryBtn, (busy || !token.trim()) && { opacity: 0.5 }]}
            onPress={() => void onSubmit()}
            disabled={busy || !token.trim()}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.primaryBtnText}>Sign in</Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
