import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";
import { type } from "../../lib/typography";
import { hapticRowTap } from "../../lib/haptics";

/** Reanimated `Pressable` — needed because `Pressable` from RN
 *  doesn't accept animated style props by default. */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  label: string;
  value: number;
  onPress?: () => void;
  variant?: "default" | "hot";
};

export function DashboardStatCard({ label, value, onPress, variant = "default" }: Props) {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  // Spring-press scale — `withSpring` runs the easing on the UI
  // thread so the dip-down on finger-down happens even when JS is
  // mid-render. The damping/stiffness pair lands the value on a
  // ~120ms motion with no overshoot.
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const inner = (
    <>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </>
  );

  if (onPress) {
    return (
      <AnimatedPressable
        accessibilityRole="button"
        onPress={() => {
          // Light "row tap" tick on the way out — paired with the
          // spring-down scale, the card feels like a physical chip
          // being pressed rather than a flat target.
          hapticRowTap();
          onPress();
        }}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 18, stiffness: 380 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 18, stiffness: 380 });
        }}
        style={[
          styles.card,
          variant === "hot" && styles.cardHot,
          animatedStyle,
        ]}
      >
        {inner}
      </AnimatedPressable>
    );
  }

  return <View style={[styles.card, variant === "hot" && styles.cardHot]}>{inner}</View>;
}

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    card: {
      flex: 1,
      minWidth: "42%",
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
      // `elevation.raised` is the brand-tinted shadow ramp declared in
      // `lib/theme.ts`. On iOS it produces a soft drop; on Android the
      // single `elevation` int gives an equivalent material shadow.
      ...theme.elevation.raised,
    },
    cardHot: {
      borderColor: theme.hotBorder,
      backgroundColor: theme.hotBg,
    },
    // `floating` is the level above `raised` — a slightly larger,
    // softer drop. Combined with a tiny opacity dip it reads as the
    // card being lifted under the finger rather than just dimming.
    pressed: { opacity: 0.96, ...theme.elevation.floating },
    value: {
      ...type.statValue,
      color: theme.text,
    },
    label: {
      ...type.caption,
      marginTop: 4,
      color: theme.textMuted,
    },
  });
