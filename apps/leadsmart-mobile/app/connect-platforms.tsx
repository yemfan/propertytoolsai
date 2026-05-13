import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  disconnectMobileMeta,
  fetchMobileConnections,
  initMobileMetaConnect,
  type MobileConnection,
} from "../lib/leadsmartMobileApi";
import {
  hapticButtonPress,
  hapticError,
  hapticSuccess,
} from "../lib/haptics";
import { useThemeTokens } from "../lib/useThemeTokens";
import type { ThemeTokens } from "../lib/theme";

/**
 * Mobile equivalent of the web /dashboard/leads/generate/connect
 * page. Currently surfaces Meta only — same scope as the LinkedIn
 * branch on web hasn't merged yet, so mobile only sees Meta until
 * that branch lands and we ship a Phase 3 mobile addition.
 *
 * Connect flow uses a mobile-specific OAuth init endpoint
 * (POST /api/mobile/leads-gen/connect/meta/init) that returns a
 * signed Meta OAuth URL with the agent's id + the mobile deep-link
 * baked into the state token. We open the URL via
 * `WebBrowser.openAuthSessionAsync` with the same deep-link as the
 * resolve URL — when Meta's OAuth completes and our /callback
 * route redirects to the deep link, the in-app browser closes and
 * we re-fetch the connections list.
 */

const RETURN_TO_DEEP_LINK = "leadsmart://leads-gen/connect/callback";

export default function ConnectPlatformsScreen() {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const [connections, setConnections] = useState<MobileConnection[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetchMobileConnections();
    if (res.ok === false) {
      setError(res.message);
      setConnections([]);
      return;
    }
    setConnections(res.connections);
  }, []);

  // Refresh on each focus — covers the case where the user came back
  // from the in-app browser after granting / cancelling.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onConnect = useCallback(async () => {
    hapticButtonPress();
    setError(null);
    setConnecting(true);
    try {
      const init = await initMobileMetaConnect(RETURN_TO_DEEP_LINK);
      if (init.ok === false) {
        throw new Error(init.message);
      }
      // openAuthSessionAsync intercepts the deep-link redirect so the
      // in-app browser closes automatically when /callback redirects
      // to leadsmart://leads-gen/connect/callback?status=...
      const result = await WebBrowser.openAuthSessionAsync(
        init.url,
        RETURN_TO_DEEP_LINK,
      );
      if (result.type === "cancel" || result.type === "dismiss") {
        setFlash("Connection cancelled.");
        hapticError();
      } else if (result.type === "success" && result.url) {
        // Parse the status param from the deep-link query.
        const status = (() => {
          try {
            const u = new URL(result.url);
            return u.searchParams.get("status");
          } catch {
            return null;
          }
        })();
        const count = (() => {
          try {
            return new URL(result.url).searchParams.get("count");
          } catch {
            return null;
          }
        })();
        const reason = (() => {
          try {
            return new URL(result.url).searchParams.get("reason");
          } catch {
            return null;
          }
        })();
        if (status === "success") {
          hapticSuccess();
          const n = Number(count) || 1;
          setFlash(`Linked ${n} Facebook ${n === 1 ? "Page" : "Pages"}.`);
        } else {
          hapticError();
          setFlash(reason ?? "Connection failed.");
        }
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start OAuth");
      hapticError();
    } finally {
      setConnecting(false);
    }
  }, [load]);

  const onDisconnect = useCallback(
    async (conn: MobileConnection) => {
      Alert.alert(
        "Disconnect Page",
        `Disconnect ${conn.fbPageName ?? "this Page"}? Posts already published will stay live on Facebook.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disconnect",
            style: "destructive",
            onPress: async () => {
              hapticButtonPress();
              setDisconnectingId(conn.id);
              const res = await disconnectMobileMeta({ id: conn.id });
              setDisconnectingId(null);
              if (res.ok === false) {
                hapticError();
                Alert.alert("Disconnect failed", res.message);
                return;
              }
              hapticSuccess();
              await load();
            },
          },
        ],
      );
    },
    [load],
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <Stack.Screen
        options={{ title: "Connect Platforms", headerBackTitle: "Back" }}
      />

      {flash && (
        <View style={styles.flash}>
          <Text style={styles.flashText}>{flash}</Text>
          <Pressable onPress={() => setFlash(null)} hitSlop={10}>
            <Ionicons name="close" size={16} color={tokens.textSubtle} />
          </Pressable>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={16} color={tokens.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Meta card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Facebook &amp; Instagram</Text>
            <Text style={styles.cardSubtitle}>
              Connect a Facebook Page. If it&apos;s linked to an Instagram
              Business account, that&apos;s connected automatically — one grant
              covers both.
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onConnect}
          disabled={connecting}
          style={[styles.connectButton, connecting && styles.connectButtonBusy]}
        >
          {connecting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="logo-facebook" size={16} color="#fff" />
              <Text style={styles.connectButtonText}>
                {connections && connections.length > 0
                  ? "Connect another"
                  : "Connect Facebook"}
              </Text>
            </>
          )}
        </Pressable>

        {connections === null ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={tokens.accent} />
          </View>
        ) : connections.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyText}>
              No Pages connected yet. Tap connect to start publishing directly
              from Quick Post.
            </Text>
          </View>
        ) : (
          <View style={styles.connectionsList}>
            {connections.map((c) => (
              <View key={c.id} style={styles.connectionRow}>
                <View style={styles.connectionLeft}>
                  {c.pictureUrl ? (
                    <Image
                      source={{ uri: c.pictureUrl }}
                      style={styles.connectionAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.connectionAvatar,
                        styles.connectionAvatarFallback,
                      ]}
                    >
                      <Text style={styles.connectionAvatarFallbackText}>
                        {(c.fbPageName ?? "?").slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.connectionInfo}>
                    <Text style={styles.connectionName} numberOfLines={1}>
                      {c.fbPageName ?? "Facebook Page"}
                    </Text>
                    {c.igBusinessUsername && (
                      <View style={styles.igBadge}>
                        <Text style={styles.igBadgeText}>
                          IG @{c.igBusinessUsername}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <Pressable
                  onPress={() => onDisconnect(c)}
                  disabled={disconnectingId === c.id}
                  style={styles.disconnectButton}
                >
                  <Text style={styles.disconnectButtonText}>
                    {disconnectingId === c.id ? "…" : "Disconnect"}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.helperText}>
          Tokens are stored encrypted; disconnect any time. To fully revoke
          the OAuth grant from Facebook&apos;s side too, visit your Facebook
          account&apos;s Apps and Websites and remove LeadSmart AI.
        </Text>
      </View>
    </ScrollView>
  );
}

function createStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: tokens.bg },
    scrollContent: { padding: 16, paddingBottom: 48 },
    flash: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: tokens.infoBg,
      borderWidth: 1,
      borderColor: tokens.infoBorder,
      marginBottom: 12,
    },
    flashText: {
      flex: 1,
      fontSize: 13,
      color: tokens.infoText,
    },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 10,
      borderRadius: 8,
      backgroundColor: tokens.dangerBg,
      borderWidth: 1,
      borderColor: tokens.dangerBorder,
      marginBottom: 12,
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      color: tokens.danger,
    },
    card: {
      backgroundColor: tokens.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: tokens.border,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 14,
    },
    cardHeaderText: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: tokens.text,
    },
    cardSubtitle: {
      marginTop: 4,
      fontSize: 13,
      lineHeight: 19,
      color: tokens.textSecondary,
    },
    connectButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: "#1877F2", // Facebook blue
    },
    connectButtonBusy: {
      opacity: 0.7,
    },
    connectButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#fff",
    },
    loadingBlock: {
      alignItems: "center",
      paddingVertical: 24,
    },
    emptyBlock: {
      marginTop: 14,
      padding: 14,
      borderRadius: 10,
      backgroundColor: tokens.surfaceMuted,
      borderWidth: 1,
      borderColor: tokens.borderSubtle,
      borderStyle: "dashed",
    },
    emptyText: {
      fontSize: 13,
      color: tokens.textSubtle,
      lineHeight: 19,
    },
    connectionsList: {
      marginTop: 14,
      gap: 8,
    },
    connectionRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: tokens.surfaceMuted,
      borderWidth: 1,
      borderColor: tokens.borderSubtle,
    },
    connectionLeft: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    connectionAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: tokens.surface,
    },
    connectionAvatarFallback: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: tokens.accentLight,
    },
    connectionAvatarFallbackText: {
      fontWeight: "700",
      color: tokens.accent,
    },
    connectionInfo: { flex: 1 },
    connectionName: {
      fontSize: 14,
      fontWeight: "700",
      color: tokens.text,
    },
    igBadge: {
      alignSelf: "flex-start",
      marginTop: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: "#FCE7F3",
    },
    igBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: "#BE185D",
    },
    disconnectButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: tokens.surface,
      borderWidth: 1,
      borderColor: tokens.border,
    },
    disconnectButtonText: {
      fontSize: 11,
      fontWeight: "700",
      color: tokens.text,
    },
    helperText: {
      marginTop: 14,
      fontSize: 11,
      lineHeight: 16,
      color: tokens.textSubtle,
    },
  });
}
