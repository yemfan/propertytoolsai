import type { MobilePipelineSlug, MobilePipelineStageOptionDto } from "@leadsmart/shared";
import { MOBILE_PIPELINE_LABELS } from "@leadsmart/shared";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../lib/theme";

type Props = {
  stages: MobilePipelineStageOptionDto[];
  selectedSlug: MobilePipelineSlug | null;
};

function labelFor(stage: MobilePipelineStageOptionDto): string {
  return MOBILE_PIPELINE_LABELS[stage.mobile_slug] ?? stage.name;
}

export function PipelineBreadcrumb({ stages, selectedSlug }: Props) {
  if (!stages.length) {
    return (
      <Text style={styles.fallback}>Pipeline stages not configured</Text>
    );
  }

  return (
    <View style={styles.row}>
      {stages.map((s, i) => {
        const selected = selectedSlug === s.mobile_slug;
        const isLast = i === stages.length - 1;
        return (
          <View key={s.id} style={styles.segment}>
            <Text style={[styles.crumb, selected && styles.crumbActive]} numberOfLines={1}>
              {labelFor(s)}
            </Text>
            {!isLast ? <Text style={styles.sep}> &gt; </Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 0,
  },
  segment: { flexDirection: "row", alignItems: "center" },
  crumb: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.textMuted,
  },
  crumbActive: {
    fontWeight: "800",
    color: theme.text,
  },
  sep: {
    fontSize: 15,
    color: theme.textSubtle,
    fontWeight: "500",
  },
  fallback: { fontSize: 14, color: theme.textMuted },
});
