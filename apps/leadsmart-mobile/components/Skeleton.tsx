import { useEffect, useMemo } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useThemeTokens } from "../lib/useThemeTokens";

/**
 * Subtle shimmer block used to replace content during initial load
 * and pagination.
 *
 * Reanimated v3 implementation — the shared value, the timing loop,
 * AND the color interpolation all run on the UI thread, so the
 * shimmer keeps animating even when JS is busy parsing a large API
 * response. That's the upgrade from the previous `Animated.Value`
 * version, which had to use `useNativeDriver: false` because
 * `backgroundColor` isn't a native-supported property — meaning the
 * animation dropped frames whenever JS was blocked (visible on
 * low-end Android during the inbox first-paint).
 *
 * The component is deliberately minimal: callers size it through
 * `width` / `height` / `borderRadius` props so the same primitive
 * can stand in for a title line, a paragraph row, an avatar circle,
 * or a whole card.
 */
export function Skeleton({
  width,
  height = 14,
  borderRadius = 6,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}) {
  const tokens = useThemeTokens();
  // 0 → 1 → 0 pulse running on the UI thread. `withRepeat(_, -1, true)`
  // reverses direction each cycle so the shimmer ping-pongs smoothly
  // instead of snapping back to 0 every iteration.
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(progress);
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [tokens.skeletonBase, tokens.skeletonHighlight],
    ),
  }));

  return (
    <Animated.View
      // Hide from screen readers so VoiceOver doesn't announce
      // "image" or similar junk during load states.
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: width ?? "100%",
          height,
          borderRadius,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

/**
 * Convenience wrapper that renders a realistic lead-row skeleton
 * at the same vertical rhythm as `LeadRow` in `(tabs)/leads.tsx`.
 * Swapping this in during initial load avoids the "empty list
 * then sudden list" flash and gives the user something to look
 * at while the network round-trip completes.
 */
export function LeadRowSkeleton() {
  const tokens = useThemeTokens();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          marginHorizontal: 12,
          marginVertical: 5,
          padding: 14,
          backgroundColor: tokens.surface,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: tokens.border,
        },
        top: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
        bottom: {
          flexDirection: "row",
          alignItems: "center",
          marginTop: 10,
          gap: 8,
        },
      }),
    [tokens]
  );

  return (
    <View style={styles.row}>
      <View style={styles.top}>
        <Skeleton width="60%" height={16} />
      </View>
      <Skeleton width="45%" height={12} style={{ marginTop: 2 }} />
      <Skeleton width="80%" height={12} style={{ marginTop: 8 }} />
      <View style={styles.bottom}>
        <Skeleton width={70} height={18} borderRadius={6} />
        <Skeleton width={50} height={12} />
      </View>
    </View>
  );
}

/**
 * Skeleton for a typical inbox message row. Matches the layout
 * of `(tabs)/inbox.tsx` — channel chip + name + preview line.
 */
export function InboxRowSkeleton() {
  const tokens = useThemeTokens();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          marginHorizontal: 12,
          marginVertical: 5,
          padding: 14,
          backgroundColor: tokens.surface,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: tokens.border,
        },
        top: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
      }),
    [tokens]
  );

  return (
    <View style={styles.row}>
      <View style={styles.top}>
        <Skeleton width={40} height={10} />
        <Skeleton width={40} height={10} style={{ marginLeft: "auto" }} />
      </View>
      <Skeleton width="55%" height={14} style={{ marginBottom: 6 }} />
      <Skeleton width="90%" height={12} />
    </View>
  );
}

/**
 * Render N skeleton rows inside a FlatList placeholder state.
 */
export function SkeletonList({
  count = 5,
  renderRow,
}: {
  count?: number;
  renderRow: (index: number) => React.ReactNode;
}) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i}>{renderRow(i)}</View>
      ))}
    </View>
  );
}
