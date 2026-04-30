import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { presentAiQuickReplyPlaceholder } from "../../lib/lead/aiQuickReplyPlaceholder";
import { buildMailtoUrl, buildSmsUrl, buildTelUrl, normalizePhoneForLinking } from "../../lib/lead/contactLinking";
import { openExternalUrl } from "../../lib/lead/openExternalUrl";
import { postMobileClickToCall } from "../../lib/leadsmartMobileApi";
import { hapticButtonPress, hapticError, hapticSuccess } from "../../lib/haptics";
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
  { key: "call", label: "Call", hint: "Bridges your phone to the contact via Twilio (logs the call)" },
  { key: "sms", label: "Text", hint: "Opens the SMS app" },
  { key: "email", label: "Email", hint: "Opens the mail composer" },
  { key: "ai", label: "AI Reply", hint: "AI-assisted reply (coming soon)" },
];

type CallUiState =
  | { kind: "idle" }
  | { kind: "calling" }
  | { kind: "ringing" }
  | { kind: "error"; message: string };

/**
 * Map structured click-to-call error codes to a short chip label.
 * The full message is set as the chip's title so a long-press on iOS
 * (or VoiceOver) reveals the why.
 */
function callErrorLabel(code: string | undefined): string {
  switch (code) {
    case "missing_agent_phone":
      return "Add phone";
    case "missing_contact_phone":
      return "No phone";
    case "invalid_phone":
      return "Bad phone";
    case "twilio_api_failed":
      return "Twilio failed";
    default:
      return "Failed";
  }
}

function callErrorDetail(code: string | undefined, fallback: string | undefined): string {
  switch (code) {
    case "missing_agent_phone":
      return "Add your phone number under Settings before placing calls.";
    case "missing_contact_phone":
      return "This contact has no phone number on file.";
    case "invalid_phone":
      return "The phone number isn't in a valid format.";
    case "missing_caller_id":
    case "twilio_not_configured":
      return "Twilio is not configured for this account.";
    case "twilio_api_failed":
      return "Twilio rejected the call.";
    default:
      return fallback ?? "Call could not be placed.";
  }
}

export function LeadQuickActionsRow({ leadId, displayPhone, email, toolbar }: LeadQuickActionsRowProps) {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const phone = normalizePhoneForLinking(displayPhone);
  const emailTrimmed = email.trim();
  const canCall = Boolean(phone);
  const canSms = Boolean(phone);
  const canEmail = Boolean(emailTrimmed);

  const [callState, setCallState] = useState<CallUiState>({ kind: "idle" });
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const scheduleReset = useCallback((ms: number) => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCallState({ kind: "idle" }), ms);
  }, []);

  /**
   * Click-to-call: ring the agent's own phone via Twilio, then bridge
   * to the contact when answered. The win over `tel:` is logging — the
   * server records every bridge attempt to lead_calls so the timeline
   * stays accurate even when the call is placed from mobile.
   *
   * Fallback: if Twilio is not configured server-side
   * (missing_caller_id / twilio_not_configured), open the device's
   * native dialer so the agent isn't blocked. Other errors surface
   * inline on the chip without falling back, since the tel: dialer
   * wouldn't fix "no phone on file" or "invalid phone".
   */
  const onCall = useCallback(async () => {
    if (!phone) return;
    hapticButtonPress();
    setCallState({ kind: "calling" });
    const res = await postMobileClickToCall(leadId);
    if (res.ok) {
      hapticSuccess();
      setCallState({ kind: "ringing" });
      scheduleReset(4000);
      return;
    }
    if (res.code === "missing_caller_id" || res.code === "twilio_not_configured") {
      // Twilio not wired — drop to the native dialer instead of failing.
      setCallState({ kind: "idle" });
      await openExternalUrl(buildTelUrl(phone), "No app can handle phone calls on this device.");
      return;
    }
    hapticError();
    setCallState({
      kind: "error",
      message: callErrorDetail(res.code, res.message),
    });
    scheduleReset(6000);
  }, [leadId, phone, scheduleReset]);

  const onPress = useCallback(
    async (key: ActionKey) => {
      if (key === "call" && phone) {
        await onCall();
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
    [leadId, phone, emailTrimmed, onCall],
  );

  const enabled = (key: ActionKey) => {
    if (key === "call") return canCall;
    if (key === "sms") return canSms;
    if (key === "email") return canEmail;
    return true;
  };

  const callLabel = (() => {
    switch (callState.kind) {
      case "calling":
        return "Calling…";
      case "ringing":
        return "Ringing…";
      case "error":
        return callErrorLabel(undefined);
      default:
        return "Call";
    }
  })();

  return (
    <View
      style={[styles.wrap, toolbar && styles.wrapToolbar]}
      accessibilityRole="toolbar"
      accessibilityLabel="Lead quick actions"
    >
      {ACTIONS.map(({ key, label, hint }) => {
        const isEnabled = enabled(key);
        const isCall = key === "call";
        const callBusy = isCall && (callState.kind === "calling" || callState.kind === "ringing");
        const callErrored = isCall && callState.kind === "error";
        const displayLabel = isCall ? callLabel : label;
        const displayHint = isCall && callState.kind === "error" ? callState.message : hint;
        return (
          <Pressable
            key={key}
            style={({ pressed }) => [
              styles.chip,
              toolbar && styles.chipToolbar,
              !isEnabled && styles.chipDisabled,
              callBusy && styles.chipBusy,
              callErrored && styles.chipError,
              pressed && isEnabled && !callBusy && styles.chipPressed,
            ]}
            onPress={() => void onPress(key)}
            disabled={(key !== "ai" && !isEnabled) || callBusy}
            accessibilityRole="button"
            accessibilityLabel={displayLabel}
            accessibilityHint={displayHint}
            accessibilityState={{ disabled: (key !== "ai" && !isEnabled) || callBusy, busy: callBusy }}
          >
            <Text
              style={[
                styles.chipLabel,
                !isEnabled && key !== "ai" && styles.chipLabelDisabled,
                callBusy && styles.chipLabelBusy,
                callErrored && styles.chipLabelError,
              ]}
              numberOfLines={1}
            >
              {displayLabel}
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
    backgroundColor: theme.surfaceElevated,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipBusy: {
    backgroundColor: theme.infoBg,
    borderColor: theme.infoText,
  },
  chipError: {
    backgroundColor: theme.dangerBg,
    borderColor: theme.dangerText,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.accent,
  },
  chipLabelDisabled: {
    color: theme.textMuted,
  },
  chipLabelBusy: {
    color: theme.infoText,
  },
  chipLabelError: {
    color: theme.dangerText,
  },
});