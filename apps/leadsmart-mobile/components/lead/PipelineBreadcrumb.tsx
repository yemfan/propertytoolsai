import type { MobilePipelineSlug, MobilePipelineStageOptionDto } from "@leadsmart/shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";

type Props = {
  stages: MobilePipelineStageOptionDto[];
  selectedSlug: MobilePipelineSlug | null;
};

export function PipelineBreadcrumb({ stages, selectedSlug }: Props) {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const { t } = useTranslation("lead_components");
  // `stage.name` (server) is the user-visible fallback when a slug
  // we don't yet have a translation key for shows up — keeps custom
  // pipelines working without forcing a release.
  const labelFor = (stage: MobilePipelineStageOptionDto): string =>
    t(`pipeline.slug.${stage.mobile_slug}`, { defaultValue: stage.name });

  if (!stages.length) {
    return (
      <Text style={styles.fallback}>{t("pipeline.breadcrumb_not_configured")}</Text>
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

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
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
