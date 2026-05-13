import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Skeleton } from "../Skeleton";
import { FadeIn } from "../Reveal";
import {
  fetchMobileBriefings,
  type MobileBriefing,
} from "../../lib/leadsmartMobileApi";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";

/**
 * Mobile briefings card.
 *
 * Product direction: on the small screen the home feed shows only
 * the LATEST briefing (whichever is newer between morning + evening
 * — typically just-fired). Once the agent has seen it, the big card
 * collapses into a compact "View past briefings →" tile that links
 * to the full history at /briefings.
 *
 * Read state is local-device via AsyncStorage. We mark the latest
 * briefing read 2 seconds after the card mounts, which roughly
 * corresponds to "the agent looked at the screen long enough to
 * register what's there." Two seconds is short enough that an
 * intentional dismiss doesn't feel premature, and long enough that
 * a casual scroll past the card does NOT mark it read.
 *
 * Why local-only (vs server-side read_at):
 *   - Synced multi-device read state is genuinely nice but requires
 *     a schema migration + per-briefing PATCH endpoint. Local state
 *     ships immediately.
 *   - The worst-case multi-device drift is "I saw it on my phone,
 *     my tablet still shows the big card." That's mildly annoying
 *     but not broken. If agents start asking for sync, we add a
 *     read_at column then.
 *
 * Push notifications: the daily-briefing cron fires
 * `dispatchMobileBriefingPush` right after the insert, so the
 * agent's phone pings when a new briefing lands. Tap → opens the
 * mobile Home → BriefingsCard re-fetches + shows the new briefing
 * inline.
 */

const READ_STORAGE_KEY = "briefings:lastReadId";
const READ_DELAY_MS = 2000;

export function BriefingsCard() {
  const tokens = useThemeTokens();
  const router = useRouter();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const [latest, setLatest] = useState<MobileBriefing | null>(null);
  const [hasOthers, setHasOthers] = useState(false);
  const [lastReadId, setLastReadId] = useState<string | null>(null);
  const [readHydrated, setReadHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hydrate the last-read id from AsyncStorage once on mount. We
  // gate the render decision on this so a "read" briefing doesn't
  // momentarily flash as the big card before collapsing.
  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(READ_STORAGE_KEY).then((v) => {
      if (cancelled) return;
      setLastReadId(v);
      setReadHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchMobileBriefings();
    if (res.ok === false) {
      setError(res.message);
      setLoading(false);
      return;
    }
    // Latest = whichever of {morning[0], evening[0]} has the most
    // recent created_at. Both buckets come back newest-first.
    const candidates = [res.morning[0], res.evening[0]].filter(
      (b): b is MobileBriefing => Boolean(b),
    );
    candidates.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    setLatest(candidates[0] ?? null);
    // Any other briefing besides the latest = there's a history
    // worth surfacing via the past-briefings tile.
    setHasOthers(
      res.morning.length + res.evening.length > (candidates[0] ? 1 : 0),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Mark the latest briefing as read after a short dwell. Only fires
  // when there's actually a latest briefing AND it's unread; pure
  // function of `latest.id` so re-mounting re-arms the timer when a
  // new briefing arrives.
  useEffect(() => {
    if (!latest || !readHydrated) return;
    if (lastReadId === latest.id) return;
    const t = setTimeout(() => {
      void AsyncStorage.setItem(READ_STORAGE_KEY, latest.id);
      setLastReadId(latest.id);
    }, READ_DELAY_MS);
    return () => clearTimeout(t);
  }, [latest, lastReadId, readHydrated]);

  if (loading || !readHydrated) {
    return (
      <View style={styles.wrap}>
        <Skeleton width="100%" height={120} borderRadius={12} />
      </View>
    );
  }

  // No briefing yet (agent's first day, or cron hasn't fired for
  // their tz). Show the empty placeholder so the agent doesn't
  // wonder whether the feature is broken.
  if (!latest) {
    return (
      <View style={styles.wrap}>
        <View style={[styles.card, styles.cardEmpty]}>
          <Text style={styles.headline}>Your first briefing arrives soon.</Text>
          <Text style={styles.summary}>
            Morning plans land at your scheduled time; evening summaries land
            after the day winds down. You can change times in Settings →
            Daily Briefings.
          </Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      </View>
    );
  }

  const isRead = lastReadId === latest.id;

  // Collapsed tile when the agent's already read the latest. Single
  // pressable that routes to the full history page.
  if (isRead) {
    return (
      <View style={styles.wrap}>
        <Pressable
          onPress={() => router.push("/briefings" as never)}
          style={styles.compactTile}
        >
          <Text style={styles.compactEmoji}>
            {latest.kind === "morning" ? "☀️" : "🌙"}
          </Text>
          <View style={styles.compactBody}>
            <Text style={styles.compactTitle}>
              {hasOthers ? "View past briefings" : "Latest briefing seen"}
            </Text>
            <Text style={styles.compactSub}>
              Last: {formatRelative(latest.created_at)}
            </Text>
          </View>
          <Text style={styles.compactChevron}>›</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <FadeIn>
        <BriefingPane row={latest} styles={styles} />
      </FadeIn>
    </View>
  );
}

function BriefingPane({
  row,
  styles,
}: {
  row: MobileBriefing;
  styles: ReturnType<typeof createStyles>;
}) {
  const isMorning = row.kind === "morning";
  const emojiBadge = isMorning ? "☀️" : "🌙";
  const title = isMorning ? "Morning Briefing" : "Evening Summary";
  const cardStyle = isMorning ? styles.cardMorning : styles.cardEvening;
  const titleStyle = isMorning ? styles.titleMorning : styles.titleEvening;

  const headline =
    row.headline?.trim() || row.summary?.split(/[.!?]\s/)[0] || title;
  const summary = row.summary ?? null;
  const highlights = pickHighlights(row);
  const opp = row.insights?.topOpportunity ?? null;

  return (
    <View style={[styles.card, cardStyle]}>
      <View style={styles.header}>
        <Text style={styles.emoji}>{emojiBadge}</Text>
        <View style={styles.headerText}>
          <Text style={[styles.title, titleStyle]}>{title}</Text>
          <Text style={styles.timestamp}>{formatRelative(row.created_at)}</Text>
        </View>
      </View>

      <Text style={styles.headline}>{headline}</Text>
      {summary ? <Text style={styles.summary}>{summary}</Text> : null}

      {highlights.length > 0 ? (
        <View style={styles.highlights}>
          {highlights.map((h, i) => (
            <View key={i} style={styles.highlightRow}>
              <Text style={styles.highlightIcon}>{h.icon}</Text>
              <Text style={styles.highlightText}>{h.text}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {opp ? (
        <View
          style={[
            styles.callout,
            isMorning ? styles.calloutMorning : styles.calloutEvening,
          ]}
        >
          <Text style={styles.calloutLabel}>✨ BEST MOVE</Text>
          <Text style={styles.calloutBody}>{opp}</Text>
        </View>
      ) : null}
    </View>
  );
}

function pickHighlights(row: MobileBriefing): Array<{ icon: string; text: string }> {
  const out: Array<{ icon: string; text: string }> = [];
  const i = row.insights ?? {};
  if (row.kind === "morning") {
    const hot = i.topHotLeads ?? [];
    if (hot.length) {
      out.push({
        icon: "🔥",
        text: `${hot.length} hot lead${hot.length === 1 ? "" : "s"} ready: ${hot.slice(0, 2).map((h) => h.name).join(", ")}${hot.length > 2 ? ", …" : ""}`,
      });
    }
    const stale = i.needsFollowUp ?? [];
    if (stale.length) {
      out.push({
        icon: "💤",
        text: `${stale.length} lead${stale.length === 1 ? "" : "s"} gone quiet 7+ days`,
      });
    }
  } else {
    const done = i.completedTasks ?? [];
    if (done.length) {
      out.push({
        icon: "✅",
        text: `${done.length} task${done.length === 1 ? "" : "s"} cleared today`,
      });
    }
    const missed = i.missedTasks ?? [];
    if (missed.length) {
      out.push({
        icon: "↪️",
        text: `${missed.length} rolling over to tomorrow`,
      });
    }
    const tomorrow = i.tomorrowTasks ?? [];
    if (tomorrow.length) {
      out.push({
        icon: "📅",
        text: `${tomorrow.length} queued for tomorrow`,
      });
    }
  }
  return out.slice(0, 3);
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor(
    (today.getTime() - new Date(iso).setHours(0, 0, 0, 0)) / dayMs,
  );
  const t = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diffDays <= 0) return `Today, ${t}`;
  if (diffDays === 1) return `Yesterday, ${t}`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function createStyles(t: ThemeTokens) {
  return StyleSheet.create({
    wrap: { gap: 12, marginTop: 8, marginBottom: 8 },

    card: {
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
    },
    cardMorning: {
      backgroundColor: t.warningBg,
      borderColor: t.warningText,
    },
    cardEvening: {
      backgroundColor: t.infoBg,
      borderColor: t.infoText,
    },
    cardEmpty: {
      backgroundColor: t.surface,
      borderColor: t.border,
      borderStyle: "dashed",
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 12,
    },
    emoji: { fontSize: 26 },
    headerText: { flex: 1 },
    title: {
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.3,
    },
    titleMorning: { color: t.warningText },
    titleEvening: { color: t.infoText },
    timestamp: {
      fontSize: 11,
      color: t.textMuted,
      marginTop: 1,
    },

    headline: {
      fontSize: 16,
      fontWeight: "700",
      lineHeight: 22,
      color: t.text,
      marginBottom: 6,
    },
    summary: {
      fontSize: 14,
      lineHeight: 20,
      color: t.text,
    },
    errorText: {
      marginTop: 10,
      fontSize: 12,
      color: t.danger,
    },

    highlights: { marginTop: 10, gap: 6 },
    highlightRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    highlightIcon: {
      fontSize: 15,
      lineHeight: 20,
    },
    highlightText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: t.text,
    },

    callout: {
      marginTop: 12,
      padding: 10,
      borderRadius: 8,
      borderWidth: 1,
    },
    calloutMorning: {
      backgroundColor: t.surface,
      borderColor: t.warningText,
    },
    calloutEvening: {
      backgroundColor: t.surface,
      borderColor: t.infoText,
    },
    calloutLabel: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.6,
      color: t.textMuted,
      marginBottom: 3,
    },
    calloutBody: {
      fontSize: 13,
      lineHeight: 18,
      color: t.text,
    },

    compactTile: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    compactEmoji: { fontSize: 20 },
    compactBody: { flex: 1 },
    compactTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: t.text,
    },
    compactSub: {
      marginTop: 2,
      fontSize: 11,
      color: t.textMuted,
    },
    compactChevron: {
      fontSize: 22,
      color: t.textMuted,
      lineHeight: 22,
    },
  });
}
