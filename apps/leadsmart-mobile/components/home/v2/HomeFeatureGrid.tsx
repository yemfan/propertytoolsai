import { Children, isValidElement, useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

const GAP = 10;

/**
 * 3-column flex grid container for HomeFeatureTile children.
 *
 * Tiles share gap math via a single `GAP` constant, and each child is
 * wrapped in a flex-basis cell so 3-per-row holds across iPhone widths
 * (320 SE, 393 iPhone 16, 430 iPhone 16 Pro Max) without needing a
 * measured layout.
 *
 * If fewer than 3 children are passed, the trailing row left-aligns
 * naturally (no spacer hack). If more than 3, rows wrap.
 */
export type HomeFeatureGridProps = {
  children: React.ReactNode;
  /** Override columns. Defaults to 3 for iPhone widths. */
  columns?: 2 | 3 | 4;
  style?: StyleProp<ViewStyle>;
};

export function HomeFeatureGrid({ children, columns = 3, style }: HomeFeatureGridProps) {
  const styles = useMemo(() => createStyles(columns), [columns]);

  // Filter out null/false children so the row arithmetic is consistent
  // when callers use `cond && <Tile />` to gate features behind flags.
  const tiles = Children.toArray(children).filter(isValidElement);

  return (
    <View style={[styles.grid, style]}>
      {tiles.map((child, i) => (
        <View key={i} style={styles.cell}>
          {child}
        </View>
      ))}
    </View>
  );
}

const createStyles = (columns: number) =>
  StyleSheet.create({
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginHorizontal: -GAP / 2,
    },
    cell: {
      // `width: ${100 / columns}%` — React Native doesn't like template
      // literals in StyleSheet objects, so compute as a plain number.
      width: `${100 / columns}%` as `${number}%`,
      paddingHorizontal: GAP / 2,
      marginBottom: GAP,
    },
  });
