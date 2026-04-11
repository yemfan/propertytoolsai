import { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { presentAiQuickReplyPlaceholder } from "../../lib/lead/aiQuickReplyPlaceholder";
import { buildMailtoUrl, buildSmsUrl, buildTelUrl, normalizePhoneForLinking } from "../../lib/lead/contactLinking";
import { openExternalUrl } from "../../lib/lead/openExternalUrl";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";

export type LeadQuickActionsRowProps = {
  leadId: string;
  displayPhone: string | null | undefined;
  email: string;
  /** When true, four equal-width actions in one row (lead detail wireframe). */
  toolbar?: boolean;
};

type ActionKey = "call" | "sms" | "email" | "ai";

const ACTIONS: { key: ActionKey; label: string; hint: string }[] = [
  { key: "call", label: "Call", hint: "Opens the phone app" },
  { key: "sms", label: "Text", hint: "Opens the SMS app" },
  { key: "email", label: "Email", hint: "Opens the mail composer" },
  { key: "ai", label: "AI Reply", hint: "AI-assisted reply (coming soon)" },
];

export function LeadQuickActionsRow({ leadId, displayPhone, email, toolbar }: LeadQuickActionsRowProps) {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const phone = normalizePhoneForLinking(displayPhone);
  const emailTrimmed = email.trim();
  const canCall = Boolean(phone);
  const canSms = Boolean(phone);
  const canEmail = Boolean(emailTrimmed);

  const onPress = useCallback(
    async (key: ActionKey) => {
      if (key === "call" && phone) {
        await openExternalUrl(buildTelUrl(phone), "No app can handle phone calls on this device.");
        return;
      }
      if (key === "sms" && phone) {
        await openExternalUrl(buildSmsUrl(phone), "No app can handle SMS on this device.");
        return;
      }
      if (key === "email" && emailTrimmed) {
        await openExternalUrl(
          buildMailtoUrl(emailTrimmed),
          "No app can handle email links on this device.",
        );
        return;
      }
      if (key === "ai") {
        presentAiQuickReplyPlaceholder(leadId, "choose");
      }
    },
    [leadId, phone, emailTrimmed],
  );

  const enabled = (key: ActionKey) => {
    if (key === "call") return canCall;
    if (key === "sms") return canSms;
    if (key === "email") return canEmail;
    return true;
  };

  return (
    <View
      style={[styles.wrap, toolbar && styles.wrapToolbar]}
      accessibilityRole="toolbar"
      accessibilityLabel="Lead quick actions"
    >
      {ACTIONS.map(({ key, label, hint }) => {
        const isEnabled = enabled(key);
        return (
          <Pressable
            key={key}
            style={({ pressed }) => [
              styles.chip,
              toolbar && styles.chipToolbar,
              !isEnabled && styles.chipDisabled,
              pressed && isEnabled && styles.chipPressed,
            ]}
            onPress={() => void onPress(key)}
            disabled={key !== "ai" && !isEnabled}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint={hint}
            accessibilityState={{ disabled: key !== "ai" && !isEnabled }}
          >
            <Text style={[styles.chipLabel, !isEnabled && key !== "ai" && styles.chipLabelDisabled]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  wrapToolbar: {
    marginTop: 0,
    paddingTop: 0,
    borderTopWidth: 0,
    flexWrap: "nowrap",
  },
  chip: {
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.border,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  chipToolbar: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
  },
  chipPressed: {
    backgroundColor: "#e2e8f0",
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.accent,
  },
  chipLabelDisabled: {
    color: theme.textMuted,
  },
});