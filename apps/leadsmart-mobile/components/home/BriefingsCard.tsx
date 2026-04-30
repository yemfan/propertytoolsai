import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Skeleton } from "../Skeleton";
import { FadeIn } from "../Reveal";
import {
  fetchMobileBriefings,
  type MobileBriefing,
} from "../../lib/leadsmartMobileApi";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";

/**
 * Mobile mirror of the web BriefingsCard. Renders the latest morning
 * (☀️) and evening (🌙) briefings stacked at the top of the home
 * screen — no history pager, per product direction (small screen
 * stays focused on what matters now).
 *
 * Empty states are intentional: when the agent has no briefing yet
 * for a kind (cron hasn't fired their tz today), we show a soft
 * "your first briefing arrives soon" placeholder rather than hiding
 * the card. Hiding would be confusing — agents would wonder whether
 * the feature is broken or just hasn't run.
 */
export function BriefingsCard() {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const [morning, setMorning] = useState<MobileBriefing | null>(null);
  const [evening, setEvening] = useState<MobileBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchMobileBriefings();
    if (res.ok === false) {
      setError(res.message);
      setLoading(false);
      return;
    }
    setMorning(res.morning[0] ?? null);
    setEvening(res.evening[0] ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.wrap}>
        <Skeleton width="100%" height={120} borderRadius={12} />
        <Skeleton
          width="100%"
          height={120}
          borderRadius={12}
          style={{ marginTop: 12 }}
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <FadeIn>
        <BriefingPane
          kind="morning"
          row={morning}
          error={error}
          styles={styles}
        />
      </FadeIn>
      <FadeIn delay={80}>
        <BriefingPane
          kind="evening"
          row={evening}
          error={error}
          styles={styles}
        />
      </FadeIn>
    </View>
  );
}

function BriefingPane({
  kind,
  row,
  error,
  styles,
}: {
  kind: "morning" | "evening";
  row: MobileBriefing | null;
  error: string | null;
  styles: ReturnType<typeof createStyles>;
}) {
  const isMorning = kind === "morning";
  const emojiBadge = isMorning ? "☀️" : "🌙";
  const title = isMorning ? "Morning Briefing" : "Evening Summary";
  const cardStyle = isMorning ? styles.cardMorning : styles.cardEvening;
  const titleStyle = isMorning ? styles.titleMorning : styles.titleEvening;

  const headline =
    row?.headline?.trim() ||
    row?.summary?.split(/[.!?]\s/)[0] ||
    (error
      ? "Briefings unavailable"
      : isMorning
        ? "Your first morning plan arrives at your scheduled time."
        : "Your first evening recap arrives after the day winds down.");

  const summary = row?.summary ?? null;
  const highlights = row ? pickHighlights(row) : [];
  const opp = row?.insights.topOpportunity ?? null;

  return (
    <View style={[styles.card, cardStyle]}>
      <View style={styles.header}>
        <Text style={styles.emoji}>{emojiBadge}</Text>
        <View style={styles.headerText}>
          <Text style={[styles.title, titleStyle]}>{title}</Text>
          <Text style={styles.timestamp}>
            {row ? formatRelative(row.created_at) : "Awaiting first run"}
          </Text>
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
  });
}
