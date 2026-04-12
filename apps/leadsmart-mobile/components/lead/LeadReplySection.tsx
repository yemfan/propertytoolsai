import type { MobileEmailMessageDto, MobileSmsMessageDto } from "@leadsmart/shared";
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  postMobileEmailAiReply,
  postMobileEmailSend,
  postMobileSmsAiReply,
  postMobileSmsSend,
} from "../../lib/leadsmartMobileApi";
import { useThemeTokens } from "../../lib/useThemeTokens";
import type { ThemeTokens } from "../../lib/theme";
import { defaultEmailReplySubject, EmailReplyModal } from "./EmailReplyModal";
import { ReplyComposer } from "./ReplyComposer";
import { hapticError, hapticSuccess } from "../../lib/haptics";
import { useNetwork } from "../../lib/offline/NetworkContext";
import { useWriteQueue } from "../../lib/offline/useWriteQueue";

function appendSms(prev: MobileSmsMessageDto[], msg: MobileSmsMessageDto): MobileSmsMessageDto[] {
  if (prev.some((m) => m.id === msg.id)) return prev;
  return [...prev, msg];
}

function appendEmail(prev: MobileEmailMessageDto[], msg: MobileEmailMessageDto): MobileEmailMessageDto[] {
  if (prev.some((m) => m.id === msg.id)) return prev;
  return [...prev, msg];
}

export type LeadReplySectionProps = {
  leadId: string;
  sms: MobileSmsMessageDto[];
  email: MobileEmailMessageDto[];
  setSms: Dispatch<SetStateAction<MobileSmsMessageDto[]>>;
  setEmail: Dispatch<SetStateAction<MobileEmailMessageDto[]>>;
  /** Preview lead — composer visible but send/AI do not call the API. */
  demo?: boolean;
};

export function LeadReplySection({
  leadId,
  sms,
  email,
  setSms,
  setEmail,
  demo = false,
}: LeadReplySectionProps) {
  const tokens = useThemeTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const { isConnected } = useNetwork();
  const { queueWrite } = useWriteQueue();
  const [smsText, setSmsText] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [smsAiLoading, setSmsAiLoading] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [smsSentFlash, setSmsSentFlash] = useState(false);
  const sentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [emailOpen, setEmailOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (sentTimer.current) clearTimeout(sentTimer.current);
    };
  }, []);

  const flashSent = useCallback(() => {
    setSmsSentFlash(true);
    if (sentTimer.current) clearTimeout(sentTimer.current);
    sentTimer.current = setTimeout(() => setSmsSentFlash(false), 2200);
  }, []);

  const onSmsAi = useCallback(async () => {
    setSmsError(null);
    if (demo) {
      setSmsError("Sample lead — connect your CRM to use AI replies.");
      return;
    }
    setSmsAiLoading(true);
    try {
      const res = await postMobileSmsAiReply(leadId);
      if (res.ok === false) {
        setSmsError(res.message);
        return;
      }
      setSmsText(res.suggestion);
    } finally {
      setSmsAiLoading(false);
    }
  }, [leadId, demo]);

  const onSmsSend = useCallback(async () => {
    const text = smsText.trim();
    if (!text) return;
    setSmsError(null);
    if (demo) {
      setSmsError("Sample lead — connect your CRM to send messages.");
      return;
    }

    // Offline: queue the write and show optimistic success
    if (!isConnected) {
      await queueWrite("sms-send", [leadId, text]);
      hapticSuccess();
      setSmsText("");
      // Flash "Queued" via the same sent flash mechanism
      flashSent();
      return;
    }

    setSmsSending(true);
    try {
      const res = await postMobileSmsSend(leadId, text);
      if (res.ok === false) {
        hapticError();
        setSmsError(res.message);
        return;
      }
      // Success haptic fires once the SMS is actually on the
      // wire — agents use this button under time pressure, so
      // the feedback has to match reality (not an optimistic
      // pre-network tick).
      hapticSuccess();
      setSms((prev) => appendSms(prev, res.message));
      setSmsText("");
      flashSent();
    } finally {
      setSmsSending(false);
    }
  }, [leadId, smsText, setSms, flashSent, demo, isConnected, queueWrite]);

  const onEmailAi = useCallback(async () => {
    const res = await postMobileEmailAiReply(leadId);
    if (res.ok === false) {
      throw new Error(res.message);
    }
    return { subject: res.subject, body: res.body };
  }, [leadId]);

  const onEmailSend = useCallback(
    async (subject: string, body: string) => {
      const res = await postMobileEmailSend(leadId, { subject, body });
      if (res.ok === false) {
        throw new Error(res.message);
      }
      setEmail((prev) => appendEmail(prev, res.message));
    },
    [leadId, setEmail]
  );

  return (
    <View style={styles.block}>
      <ReplyComposer
        value={smsText}
        onChangeText={setSmsText}
        onSend={() => void onSmsSend()}
        onAiDraft={() => void onSmsAi()}
        sending={smsSending}
        aiLoading={smsAiLoading}
        error={smsError}
        showSent={smsSentFlash}
        hideLabel
        placeholder="Type a reply…"
      />
      {!demo ? (
        <Pressable
          style={styles.emailBtn}
          onPress={() => setEmailOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Reply by email"
        >
          <Text style={styles.emailBtnText}>Reply by email</Text>
        </Pressable>
      ) : null}
      <EmailReplyModal
        visible={emailOpen}
        onClose={() => setEmailOpen(false)}
        initialSubject={defaultEmailReplySubject(email)}
        emailThread={email}
        onSend={onEmailSend}
        onRequestAiDraft={onEmailAi}
      />
    </View>
  );
}

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    block: { backgroundColor: theme.surface },
  emailBtn: {
    paddingVertical: 12,
    marginHorizontal: 12,
    marginBottom: 8,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg,
  },
  emailBtnText: { fontSize: 15, fontWeight: "700", color: theme.accent },
});
