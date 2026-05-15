import type { MobileEmailMessageDto } from "@leadsmart/shared";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";
import { hapticError, hapticSuccess } from "../../lib/haptics";
import { AiReplyButton } from "./AiReplyButton";
import { AiActionGateBanner } from "../AiActionGateBanner";
import type { AiActionGate } from "../../lib/aiActionGate";

type EmailReplyT = (key: string) => string;

/**
 * `t` should be the function returned by `useTranslation("reply_composer")`
 * — callers (e.g. LeadReplySection) own the hook and pass it down so the
 * "Re:" prefix and "Message from your agent" fallback match the active
 * locale.
 */
export function defaultEmailReplySubject(
  thread: MobileEmailMessageDto[],
  t: EmailReplyT,
): string {
  const lastIn = [...thread].reverse().find((m) => m.direction === "inbound");
  const s = lastIn?.subject?.trim();
  if (!s) return t("email.default_subject");
  return s.toLowerCase().startsWith("re:") ? s : `${t("email.subject_prefix")}${s}`;
}

/**
 * AI draft result handed back from the parent's `onRequestAiDraft`.
 * Three terminal cases:
 *   - `ok: true`             — fill subject + body
 *   - `ok: false, gate`      — entitlement blocks AI; render the
 *                              shared upgrade banner inline
 *   - `ok: false, error`     — generic failure; show the red error string
 */
export type EmailAiDraftResult =
  | { ok: true; subject: string; body: string }
  | { ok: false; gate: AiActionGate }
  | { ok: false; error: string };

export type EmailReplyModalProps = {
  visible: boolean;
  onClose: () => void;
  initialSubject: string;
  emailThread: MobileEmailMessageDto[];
  onSend: (subject: string, body: string) => Promise<void>;
  onRequestAiDraft: () => Promise<EmailAiDraftResult>;
};

/**
 * Lead-reply composer rendered as a gesture-driven bottom sheet.
 *
 * Migrated from the hand-rolled `Modal` + slide-up pane to
 * `@gorhom/bottom-sheet`. The public prop shape stays the same
 * (`visible`/`onClose`/...) so callers don't change; internally a
 * ref-driven `BottomSheetModal` opens on `visible: true` and dismisses
 * on `visible: false`. Two snap points — `60%` (default, comfortable
 * typing height) and `92%` (expanded for long replies) — give the user
 * a drag-up affordance instead of forcing a single height.
 *
 * `BottomSheetTextInput` is required for inputs inside the sheet so
 * the sheet pans up correctly when the keyboard opens; plain RN
 * `TextInput` works for the subject row because it's short and
 * single-line, but `BottomSheetTextInput` is used for both for
 * consistency and to keep the keyboard-coordinated scroll working on
 * Android.
 */
export function EmailReplyModal({
  visible,
  onClose,
  initialSubject,
  emailThread,
  onSend,
  onRequestAiDraft,
}: EmailReplyModalProps) {
  const insets = useSafeAreaInsets();
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const { t } = useTranslation("reply_composer");
  const sheetRef = useRef<BottomSheetModal>(null);

  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<AiActionGate | null>(null);

  // `visible` is the public-facing toggle the caller controls. We
  // forward it to the imperative ref API of @gorhom/bottom-sheet here.
  // When the user swipes the sheet closed, `onDismiss` runs and we
  // call `onClose()` so the caller's `emailOpen` state stays in sync.
  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setSubject(initialSubject);
      setBody("");
      setError(null);
      setGate(null);
    }
  }, [visible, initialSubject]);

  // Two snap points — 60% for the comfortable default; 92% when the
  // user drags up to compose a long reply. Stored as percent strings
  // because that's what @gorhom/bottom-sheet expects on `snapPoints`.
  const snapPoints = useMemo(() => ["60%", "92%"], []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        // Tap the backdrop to dismiss — matches the previous modal
        // behavior. `appearsOnIndex={0}` fades in as soon as the sheet
        // opens; `disappearsOnIndex={-1}` fades out only when fully
        // closed.
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.45}
        pressBehavior="close"
      />
    ),
    [],
  );

  const onAi = async () => {
    setError(null);
    setGate(null);
    setAiLoading(true);
    try {
      const d = await onRequestAiDraft();
      if (d.ok) {
        setSubject(d.subject);
        setBody(d.body);
        return;
      }
      if ("gate" in d) {
        setGate(d.gate);
        return;
      }
      setError(d.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("email.errors.ai_draft_failed"));
    } finally {
      setAiLoading(false);
    }
  };

  const submit = async () => {
    setError(null);
    const sub = subject.trim();
    const txt = body.trim();
    if (!sub || !txt) {
      setError(t("email.errors.subject_body_required"));
      return;
    }
    setSending(true);
    try {
      await onSend(sub, txt);
      hapticSuccess();
      Keyboard.dismiss();
      onClose();
    } catch (e) {
      hapticError();
      setError(e instanceof Error ? e.message : t("email.errors.send_failed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      // `keyboardBehavior: 'interactive'` makes the sheet pan with the
      // keyboard on iOS so the input stays visible while typing;
      // `keyboardBlurBehavior: 'restore'` returns the sheet to its
      // snap point when the keyboard closes, instead of leaving it
      // stuck at the expanded height.
      keyboardBehavior={Platform.OS === "ios" ? "interactive" : "extend"}
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handle}
      enablePanDownToClose
    >
      <BottomSheetView
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
      >
        <Text style={styles.title}>{t("email.title")}</Text>
        {emailThread.length === 0 ? (
          <Text style={styles.hint}>{t("email.hint_empty_thread")}</Text>
        ) : null}
        {gate ? <AiActionGateBanner reason={gate.reason} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.fieldLabel}>{t("email.field_subject")}</Text>
        <BottomSheetTextInput
          style={styles.input}
          value={subject}
          onChangeText={setSubject}
          placeholder={t("email.placeholder_subject")}
          placeholderTextColor={tokens.textSubtle}
          editable={!sending}
          accessibilityLabel={t("email.a11y.subject")}
        />
        <View style={styles.aiRow}>
          <Text style={styles.fieldLabel}>{t("email.field_body")}</Text>
          <AiReplyButton onPress={() => void onAi()} loading={aiLoading} disabled={sending} />
        </View>
        <BottomSheetTextInput
          style={[styles.input, styles.bodyInput]}
          value={body}
          onChangeText={setBody}
          placeholder={t("email.placeholder_body")}
          placeholderTextColor={tokens.textSubtle}
          multiline
          textAlignVertical="top"
          editable={!sending}
          accessibilityLabel={t("email.a11y.body")}
        />
        <View style={styles.actions}>
          <Pressable
            style={styles.secondary}
            onPress={onClose}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel={t("email.a11y.cancel")}
          >
            <Text style={styles.secondaryText}>{t("email.cancel")}</Text>
          </Pressable>
          <Pressable
            style={[styles.primary, sending && styles.primaryDisabled]}
            onPress={() => void submit()}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel={t("email.a11y.send")}
          >
            {sending ? (
              <ActivityIndicator color={tokens.textOnAccent} />
            ) : (
              <Text style={styles.primaryText}>{t("email.send")}</Text>
            )}
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    sheetBackground: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    handle: {
      backgroundColor: theme.border,
      width: 40,
      height: 4,
      borderRadius: 2,
    },
    sheet: {
      paddingHorizontal: 20,
      paddingTop: 8,
      flex: 1,
    },
    title: { fontSize: 18, fontWeight: "800", color: theme.text, marginBottom: 8 },
    hint: { fontSize: 13, color: theme.textMuted, marginBottom: 8 },
    error: { fontSize: 13, color: theme.dangerTitle, marginBottom: 8 },
    fieldLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.textMuted,
      marginBottom: 6,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    aiRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 12,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: theme.text,
      backgroundColor: theme.bg,
    },
    bodyInput: { minHeight: 160, marginTop: 0 },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 12,
      marginTop: 16,
    },
    secondary: { paddingVertical: 12, paddingHorizontal: 16 },
    secondaryText: { fontSize: 16, fontWeight: "600", color: theme.textMuted },
    primary: {
      backgroundColor: theme.accent,
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 12,
      minWidth: 100,
      alignItems: "center",
    },
    primaryDisabled: { opacity: 0.6 },
    primaryText: { color: theme.textOnAccent, fontSize: 16, fontWeight: "700" },
  });
