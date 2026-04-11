import { useEffect, useRef, type ReactNode } from "react";
import { Animated, type ViewStyle } from "react-native";

/**
 * Animation primitives for batch 6 polish.
 *
 * The whole point here is to soften the moment when content
 * arrives — list screens used to "pop" from skeleton to data
 * with a hard cut, which always reads as a glitch even when the
 * data was actually already cached. Wrapping the post-skeleton
 * tree in `<FadeIn>` makes the same transition feel intentional.
 *
 * Both components use the JS-driver Animated API rather than
 * Reanimated 3 because (a) Reanimated isn't a current dependency
 * and adding it for two opacity tweens would be overkill, and
 * (b) `useNativeDriver: true` works fine for opacity + transform
 * which is the only thing we animate. The cost on a low-end
 * Android is sub-millisecond per tween.
 */

const DEFAULT_DURATION = 260;
const DEFAULT_TRANSLATE_Y = 8;

/**
 * Fades a subtree from 0 → 1 opacity on mount, with an optional
 * subtle upward translate (default 8px). Use this around any
 * "ready state" tree that replaces a skeleton — the loading-to-
 * ready transition becomes a smooth crossfade instead of a hard
 * pop.
 *
 * Re-mounting (e.g. when a key changes) replays the animation,
 * which is exactly the right behavior for filter-changes on the
 * leads screen — the new dataset slides in instead of jumping.
 */
export function FadeIn({
  children,
  duration = DEFAULT_DURATION,
  translateY = DEFAULT_TRANSLATE_Y,
  delay = 0,
  style,
}: {
  children: ReactNode;
  duration?: number;
  translateY?: number;
  delay?: number;
  style?: ViewStyle;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const offset = useRef(new Animated.Value(translateY)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(offset, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, offset, duration, delay]);

  return (
    <Animated.View
      style={[
        {
          opacity,
          transform: [{ translateY: offset }],
          flex: 1,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Like `FadeIn` but does NOT take `flex: 1`. For inline blocks
 * inside a ScrollView where you want each section to fade in on
 * its own without stretching the parent layout. Use the `delay`
 * prop to stagger sections — e.g., hero at 0, agenda at 60ms,
 * priority alerts at 120ms — so the page assembles with a soft
 * cascade instead of all-at-once.
 */
export function RevealBlock({
  children,
  duration = DEFAULT_DURATION,
  translateY = DEFAULT_TRANSLATE_Y,
  delay = 0,
  style,
}: {
  children: ReactNode;
  duration?: number;
  translateY?: number;
  delay?: number;
  style?: ViewStyle;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const offset = useRef(new Animated.Value(translateY)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(offset, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, offset, duration, delay]);

  return (
    <Animated.View
      style={[
        {
          opacity,
          transform: [{ translateY: offset }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
