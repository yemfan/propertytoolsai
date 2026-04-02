import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { getLeadsmartApiBaseUrl, getSupabaseAnonKey, getSupabaseUrl } from "../../lib/env";
import { onboardingStyles as s } from "../../lib/onboarding/styles";
import { useLeadsmartSession } from "../../lib/session/LeadsmartSessionContext";

const oauthBtn = StyleSheet.create({
  row: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  rowApple: {
    marginTop: 10,
    backgroundColor: "#000",
    borderColor: "#000",
  },
  label: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  labelApple: { color: "#fff" },
});

const inputCompact = [s.input, { minHeight: 52, textAlignVertical: "center" as const }];

export default function OnboardingLoginScreen() {
  const router = useRouter();
  const {
    signInWithEmailPassword,
    signInWithToken,
    signInWithGoogleOAuth,
    signInWithAppleOAuth,
    onboardingComplete,
  } = useLeadsmartSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [showTokenFallback, setShowTokenFallback] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = getLeadsmartApiBaseUrl();
  const oauthAvailable = Boolean(getSupabaseUrl().trim() && getSupabaseAnonKey().trim());

  function goAfterSignIn() {
    if (onboardingComplete) {
      router.replace("/(tabs)/inbox");
    } else {
      router.replace("/(onboarding)/notifications");
    }
  }

  async function onSubmitEmailPassword() {
    setError(null);
    setBusy(true);
    try {
      await signInWithEmailPassword(email, password, rememberDevice);
      goAfterSignIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitToken() {
    setError(null);
    setBusy(true);
    try {
      await signInWithToken(token, rememberDevice);
      goAfterSignIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogleOAuth(rememberDevice);
      goAfterSignIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onApple() {
    setError(null);
    setBusy(true);
    try {
      await signInWithAppleOAuth(rememberDevice);
      goAfterSignIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

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
            Use the same email and password as LeadSmart AI web. Your session is stored on this device; the app sends
            your Supabase access token to the LeadSmart API automatically.
          </Text>
          {!apiUrl ? (
            <Text style={s.error}>Missing API URL — set EXPO_PUBLIC_LEADSMART_API_URL in .env or app config.</Text>
          ) : (
            <Text style={s.muted} numberOfLines={2}>
              API: {apiUrl}
            </Text>
          )}

          {!showTokenFallback && oauthAvailable ? (
            <>
              <Text style={[s.muted, { marginTop: 20 }]}>Continue with</Text>
              <Pressable
                style={[oauthBtn.row, busy && { opacity: 0.6 }]}
                onPress={() => void onGoogle()}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
              >
                <Text style={oauthBtn.label}>Continue with Google</Text>
              </Pressable>
              <Pressable
                style={[oauthBtn.row, oauthBtn.rowApple, busy && { opacity: 0.6 }]}
                onPress={() => void onApple()}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Continue with Apple"
              >
                <Text style={[oauthBtn.label, oauthBtn.labelApple]}>Continue with Apple</Text>
              </Pressable>
              <Text style={[s.muted, { marginTop: 16, textAlign: "center" }]}>or with email</Text>
            </>
          ) : null}

          {!showTokenFallback ? (
            <>
              <TextInput
                style={inputCompact}
                placeholder="Email"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!busy}
                accessibilityLabel="Email"
              />
              <TextInput
                style={inputCompact}
                placeholder="Password"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                accessibilityLabel="Password"
              />
            </>
          ) : (
            <>
              <Text style={s.body}>
                Paste a JWT only for troubleshooting or if email sign-in is unavailable. Get it from the browser after
                signing in at LeadSmart AI (session access token).
              </Text>
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
            </>
          )}

          {error ? <Text style={s.error}>{error}</Text> : null}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 16,
              gap: 12,
            }}
          >
            <Text style={[s.muted, { flex: 1, marginTop: 0 }]}>Remember this device</Text>
            <Switch
              value={rememberDevice}
              onValueChange={setRememberDevice}
              disabled={busy}
              accessibilityLabel="Remember this device"
            />
          </View>
          <Text style={[s.muted, { fontSize: 12, marginTop: 6 }]}>
            When off, you&apos;ll be signed out after you fully close the app.
          </Text>

          <Pressable
            onPress={() => {
              setShowTokenFallback((v) => !v);
              setError(null);
            }}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={showTokenFallback ? "Use email sign-in" : "Use token instead"}
          >
            <Text style={[s.muted, { textDecorationLine: "underline", marginTop: 8 }]}>
              {showTokenFallback ? "← Sign in with email" : "Advanced: sign in with token"}
            </Text>
          </Pressable>
        </View>
        <View>
          {!showTokenFallback ? (
            <Pressable
              style={[s.primaryBtn, (busy || !email.trim() || !password) && { opacity: 0.5 }]}
              onPress={() => void onSubmitEmailPassword()}
              disabled={busy || !email.trim() || !password}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryBtnText}>Sign in</Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={[s.primaryBtn, (busy || !token.trim()) && { opacity: 0.5 }]}
              onPress={() => void onSubmitToken()}
              disabled={busy || !token.trim()}
              accessibilityRole="button"
              accessibilityLabel="Sign in with token"
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryBtnText}>Continue with token</Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
