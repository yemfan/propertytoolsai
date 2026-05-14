import type { MobilePipelineSlug, MobilePipelineStageOptionDto } from "@leadsmart/shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";

type Props = {
  stages: MobilePipelineStageOptionDto[];
  selectedSlug: MobilePipelineSlug | null;
  disabled?: boolean;
  busySlug?: MobilePipelineSlug | null;
  onSelect: (slug: MobilePipelineSlug) => void;
};

export function PipelineStagePicker({
  stages,
  selectedSlug,
  disabled,
  busySlug,
  onSelect,
}: Props) {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const { t } = useTranslation("lead_components");
  // Custom pipelines (slugs outside the canonical six) fall back to
  // `stage.name` so workspaces with bespoke stages keep working.
  const labelFor = (stage: MobilePipelineStageOptionDto): string =>
    t(`pipeline.slug.${stage.mobile_slug}`, { defaultValue: stage.name });

  if (!stages.length) {
    return (
      <View style={styles.unavailable}>
        <Text style={styles.unavailableText}>{t("pipeline.picker_unavailable")}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {stages.map((s) => {
        const selected = selectedSlug === s.mobile_slug;
        const busy = busySlug === s.mobile_slug;
        return (
          <Pressable
            key={s.id}
            disabled={disabled || Boolean(busySlug)}
            onPress={() => onSelect(s.mobile_slug)}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.chipSelected,
              pressed && !disabled && styles.chipPressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator size="small" color={selected ? tokens.textOnAccent : tokens.accent} />
            ) : (
              <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
                {labelFor(s)}
              </Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      flexWrap: "nowrap",
      gap: 8,
      paddingVertical: 4,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.border,
      minWidth: 72,
      alignItems: "center",
      justifyContent: "center",
    },
    chipSelected: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    chipPressed: { opacity: 0.85 },
    chipText: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.text,
    },
    chipTextSelected: { color: theme.textOnAccent },
    unavailable: {
      paddingVertical: 8,
    },
    unavailableText: {
      fontSize: 13,
      color: theme.textMuted,
    },
  });
