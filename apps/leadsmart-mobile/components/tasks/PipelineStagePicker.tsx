import type { MobilePipelineSlug, MobilePipelineStageOptionDto } from "@leadsmart/shared";
import { MOBILE_PIPELINE_LABELS } from "@leadsmart/shared";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { theme } from "../../lib/theme";

type Props = {
  stages: MobilePipelineStageOptionDto[];
  selectedSlug: MobilePipelineSlug | null;
  disabled?: boolean;
  busySlug?: MobilePipelineSlug | null;
  onSelect: (slug: MobilePipelineSlug) => void;
};

function labelFor(stage: MobilePipelineStageOptionDto): string {
  return MOBILE_PIPELINE_LABELS[stage.mobile_slug] ?? stage.name;
}

export function PipelineStagePicker({
  stages,
  selectedSlug,
  disabled,
  busySlug,
  onSelect,
}: Props) {
  if (!stages.length) {
    return (
      <View style={styles.unavailable}>
        <Text style={styles.unavailableText}>Pipeline stages unavailable for this account.</Text>
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
              <ActivityIndicator size="small" color={selected ? "#fff" : theme.accent} />
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

const styles = StyleSheet.create({
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
    backgroundColor: "#f1f5f9",
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
  chipTextSelected: { color: "#fff" },
  unavailable: {
    paddingVertical: 8,
  },
  unavailableText: {
    fontSize: 13,
    color: theme.textMuted,
  },
});
