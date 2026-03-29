import type {
  MobileBookingLinkDto,
  MobileCalendarEventDto,
  MobileEmailMessageDto,
  MobileLeadPipelineDto,
  MobileLeadRecordDto,
  MobileLeadTaskDto,
  MobilePipelineSlug,
  MobilePipelineStageOptionDto,
  MobileSmsMessageDto,
} from "@leadsmart/shared";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LeadQuickActionsRow } from "../../components/lead/LeadQuickActionsRow";
import { LeadReplySection } from "../../components/lead/LeadReplySection";
import { ScreenLoading } from "../../components/ScreenLoading";
import { AppointmentCard } from "../../components/calendar/AppointmentCard";
import { AppointmentComposerModal } from "../../components/calendar/AppointmentComposerModal";
import { BookingLinkCard } from "../../components/calendar/BookingLinkCard";
import { BookingLinkComposerModal } from "../../components/calendar/BookingLinkComposerModal";
import { PipelineStagePicker } from "../../components/tasks/PipelineStagePicker";
import { TaskCard } from "../../components/tasks/TaskCard";
import { TaskComposerModal } from "../../components/tasks/TaskComposerModal";
import { formatShortDateTime } from "../../lib/format";
import { leadField } from "../../lib/leadRecord";
import { getDemoLeadRecord, getDemoSmsThread, isDemoLeadId } from "../../lib/demoLead";
import {
  fetchMobileLeadDetail,
  patchLeadPipelineStage,
  patchMobileCalendarEvent,
  patchMobileTask,
} from "../../lib/leadsmartMobileApi";
import type { MobileApiFailure } from "../../lib/leadsmartMobileApi";
import { useLeadDetailRealtime } from "../../lib/realtime/useLeadDetailRealtime";
import { theme } from "../../lib/theme";

const emptyPipeline: MobileLeadPipelineDto = {
  stage_id: null,
  mobile_slug: null,
  name: null,
};

function MessageBubble({
  m,
  kind,
}: {
  m: MobileSmsMessageDto | MobileEmailMessageDto;
  kind: "sms" | "email";
}) {
  const inbound = m.direction === "inbound";
  const subject = kind === "email" && "subject" in m && m.subject ? m.subject : null;
  return (
    <View style={[styles.bubbleWrap, inbound ? styles.bubbleInbound : styles.bubbleOutbound]}>
      {subject ? <Text style={styles.bubbleSubject}>{subject}</Text> : null}
      <Text style={styles.bubbleBody}>{m.message || "—"}</Text>
      <Text style={styles.bubbleMeta}>
        {inbound ? "Inbound" : "Outbound"} · {formatShortDateTime(m.created_at)}
      </Text>
    </View>
  );
}

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const leadId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";

  const [lead, setLead] = useState<MobileLeadRecordDto | null>(null);
  const [sms, setSms] = useState<MobileSmsMessageDto[]>([]);
  const [email, setEmail] = useState<MobileEmailMessageDto[]>([]);
  const [pipeline, setPipeline] = useState<MobileLeadPipelineDto>(emptyPipeline);
  const [pipelineStages, setPipelineStages] = useState<MobilePipelineStageOptionDto[]>([]);
  const [nextOpenTask, setNextOpenTask] = useState<MobileLeadTaskDto | null>(null);
  const [nextAppointment, setNextAppointment] = useState<MobileCalendarEventDto | null>(null);
  const [bookingLinks, setBookingLinks] = useState<MobileBookingLinkDto[]>([]);
  const [pipelineBusySlug, setPipelineBusySlug] = useState<MobilePipelineSlug | null>(null);
  const [nextTaskCompleting, setNextTaskCompleting] = useState(false);
  const [pipelineActionError, setPipelineActionError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [bookingLinkModalOpen, setBookingLinkModalOpen] = useState(false);
  const [appointmentCancelling, setAppointmentCancelling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<MobileApiFailure | null>(null);

  const load = useCallback(async (mode: "full" | "refresh") => {
    if (!leadId) {
      setError({ ok: false, status: 0, message: "Missing lead id." });
      setLoading(false);
      return;
    }
    if (isDemoLeadId(leadId)) {
      if (mode === "full") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
      setLead(getDemoLeadRecord());
      setSms(getDemoSmsThread());
      setEmail([]);
      setPipeline(emptyPipeline);
      setPipelineStages([]);
      setNextOpenTask(null);
      setNextAppointment(null);
      setBookingLinks([]);
      setPipelineActionError(null);
      setScheduleError(null);
      setError(null);
      return;
    }
    if (mode === "full") {
      setLoading(true);
      setError(null);
    }
    if (mode === "refresh") setRefreshing(true);

    const res = await fetchMobileLeadDetail(leadId);

    if (mode === "full") setLoading(false);
    if (mode === "refresh") setRefreshing(false);

    if (res.ok === false) {
      setError(res);
      setLead(null);
      setSms([]);
      setEmail([]);
      setPipeline(emptyPipeline);
      setPipelineStages([]);
      setNextOpenTask(null);
      setNextAppointment(null);
      setBookingLinks([]);
      return;
    }
    setLead(res.lead);
    setSms(res.conversations.sms);
    setEmail(res.conversations.email);
    setPipeline(res.pipeline);
    setPipelineStages(res.pipeline_stages);
    setNextOpenTask(res.next_open_task);
    setNextAppointment(res.next_appointment);
    setBookingLinks(res.booking_links);
    setPipelineActionError(null);
    setScheduleError(null);
    setError(null);
  }, [leadId]);

  useEffect(() => {
    void load("full");
  }, [load]);

  const silentRefresh = useCallback(async () => {
    if (!leadId || isDemoLeadId(leadId)) return;
    const res = await fetchMobileLeadDetail(leadId);
    if (res.ok === false) return;
    setLead(res.lead);
    setSms(res.conversations.sms);
    setEmail(res.conversations.email);
    setPipeline(res.pipeline);
    setPipelineStages(res.pipeline_stages);
    setNextOpenTask(res.next_open_task);
    setNextAppointment(res.next_appointment);
    setBookingLinks(res.booking_links);
    setError(null);
  }, [leadId]);

  useLeadDetailRealtime(
    leadId,
    silentRefresh,
    Boolean(leadId) && !isDemoLeadId(leadId) && !loading
  );

  useLayoutEffect(() => {
    if (!lead) return;
    const title = leadField(lead, "name") || `Lead ${lead.id}`;
    navigation.setOptions({ title });
  }, [lead, navigation]);

  const onRefresh = useCallback(() => {
    void load("refresh");
  }, [load]);

  const onSelectPipelineStage = useCallback(
    async (slug: MobilePipelineSlug) => {
      if (!leadId || isDemoLeadId(leadId)) return;
      setPipelineActionError(null);
      setPipelineBusySlug(slug);
      const res = await patchLeadPipelineStage(leadId, { stage_slug: slug });
      setPipelineBusySlug(null);
      if (res.ok === false) {
        setPipelineActionError(res.message);
        return;
      }
      const stage = pipelineStages.find((s) => s.mobile_slug === slug);
      setPipeline({
        stage_id: res.pipeline_stage_id,
        mobile_slug: slug,
        name: stage?.name ?? null,
      });
    },
    [leadId, pipelineStages]
  );

  const onCompleteNextTask = useCallback(async () => {
    if (!nextOpenTask || !leadId || isDemoLeadId(leadId)) return;
    setPipelineActionError(null);
    setNextTaskCompleting(true);
    const res = await patchMobileTask(nextOpenTask.id, { status: "done" });
    setNextTaskCompleting(false);
    if (res.ok === false) {
      setPipelineActionError(res.message);
      return;
    }
    await silentRefresh();
  }, [nextOpenTask, leadId, silentRefresh]);

  const onCancelNextAppointment = useCallback(async () => {
    if (!nextAppointment || !leadId || isDemoLeadId(leadId)) return;
    setScheduleError(null);
    setAppointmentCancelling(true);
    const res = await patchMobileCalendarEvent(nextAppointment.id, { status: "cancelled" });
    setAppointmentCancelling(false);
    if (res.ok === false) {
      setScheduleError(res.message);
      return;
    }
    await silentRefresh();
  }, [nextAppointment, leadId, silentRefresh]);

  if (loading) {
    return <ScreenLoading message="Loading lead…" />;
  }

  if (error || !lead) {
    return (
      <View style={styles.centered}>
        <ErrorBanner
          title="Unable to load lead"
          message={error?.message ?? "Not found."}
          onRetry={() => {
            void load("full");
          }}
        />
      </View>
    );
  }

  const name = leadField(lead, "name") || `Lead ${lead.id}`;
  const rating = leadField(lead, "rating");
  const hot = rating.toLowerCase() === "hot";
  const lastActivity = leadField(lead, "last_activity_at");

  return (
    <KeyboardAvoidingView
      style={styles.kav}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
      <View style={styles.card}>
        {isDemoLeadId(lead.id) ? (
          <View style={styles.demoBanner}>
            <Text style={styles.demoBannerText}>
              Sample lead — not synced to your CRM. Real conversations appear here after you connect leads.
            </Text>
          </View>
        ) : null}
        <View style={styles.titleRow}>
          <Text style={styles.title}>{name}</Text>
          {hot ? (
            <View style={styles.hotPill}>
              <Text style={styles.hotText}>Hot</Text>
            </View>
          ) : null}
        </View>
        {lastActivity ? (
          <Text style={styles.lastActive}>Last activity {formatShortDateTime(lastActivity)}</Text>
        ) : null}
        {lead.display_phone ? <Text style={styles.line}>{lead.display_phone}</Text> : null}
        {leadField(lead, "email") ? <Text style={styles.line}>{leadField(lead, "email")}</Text> : null}
        {leadField(lead, "property_address") ? (
          <Text style={styles.line}>{leadField(lead, "property_address")}</Text>
        ) : null}
        <View style={styles.metaRow}>
          {leadField(lead, "lead_status") ? (
            <Text style={styles.badge}>{leadField(lead, "lead_status")}</Text>
          ) : null}
          {leadField(lead, "source") ? (
            <Text style={styles.muted}>Source: {leadField(lead, "source")}</Text>
          ) : null}
        </View>
        {lead.ai_lead_score != null ? (
          <Text style={styles.aiLine}>
            AI score {Math.round(lead.ai_lead_score)}
            {lead.ai_intent ? ` · ${lead.ai_intent}` : ""}
            {lead.ai_timeline ? ` · ${lead.ai_timeline}` : ""}
          </Text>
        ) : null}
        {!isDemoLeadId(lead.id) ? (
          <>
            <Text style={styles.cardSectionTitle}>Pipeline</Text>
            {pipelineActionError ? (
              <Text style={styles.inlineError}>{pipelineActionError}</Text>
            ) : null}
            <PipelineStagePicker
              stages={pipelineStages}
              selectedSlug={pipeline.mobile_slug}
              busySlug={pipelineBusySlug ?? undefined}
              onSelect={onSelectPipelineStage}
            />
            <Text style={styles.cardSectionTitle}>Next task</Text>
            {nextOpenTask ? (
              <View style={styles.taskBlock}>
                <TaskCard
                  variant="compact"
                  task={nextOpenTask}
                  showLeadName={false}
                  onComplete={() => void onCompleteNextTask()}
                  completing={nextTaskCompleting}
                />
              </View>
            ) : (
              <View style={styles.sectionEmpty}>
                <EmptyState title="No open task" />
              </View>
            )}
            <Pressable
              onPress={() => setTaskModalOpen(true)}
              style={({ pressed }) => [styles.addTaskBtn, pressed && styles.addTaskBtnPressed]}
            >
              <Text style={styles.addTaskBtnText}>Add task</Text>
            </Pressable>
            <Text style={styles.cardSectionTitle}>Schedule</Text>
            {scheduleError ? <Text style={styles.inlineError}>{scheduleError}</Text> : null}
            {nextAppointment ? (
              <View style={styles.taskBlock}>
                <AppointmentCard
                  variant="compact"
                  event={nextAppointment}
                  onCancel={() => void onCancelNextAppointment()}
                  cancelling={appointmentCancelling}
                />
              </View>
            ) : (
              <View style={styles.sectionEmpty}>
                <EmptyState title="No upcoming appointment" />
              </View>
            )}
            {bookingLinks.length > 0 ? (
              <View style={styles.bookingBlock}>
                <Text style={styles.bookingLinksLabel}>Booking links</Text>
                {bookingLinks.map((link) => (
                  <BookingLinkCard key={link.id} link={link} compact />
                ))}
              </View>
            ) : null}
            <View style={styles.scheduleRow}>
              <Pressable
                onPress={() => setAppointmentModalOpen(true)}
                style={({ pressed }) => [styles.scheduleBtn, pressed && styles.addTaskBtnPressed]}
              >
                <Text style={styles.scheduleBtnText}>Schedule</Text>
              </Pressable>
              <Pressable
                onPress={() => setBookingLinkModalOpen(true)}
                style={({ pressed }) => [styles.scheduleBtnGreen, pressed && styles.addTaskBtnPressed]}
              >
                <Text style={styles.scheduleBtnGreenText}>Booking link</Text>
              </Pressable>
            </View>
          </>
        ) : null}
        <LeadQuickActionsRow
          leadId={lead.id}
          displayPhone={lead.display_phone}
          email={leadField(lead, "email")}
        />
      </View>

      <Text style={styles.sectionTitle}>SMS</Text>
      <Text style={styles.sectionHint}>Recent thread (oldest at top)</Text>
      {sms.length === 0 ? (
        <View style={styles.sectionEmpty}>
          <EmptyState title="No SMS messages" />
        </View>
      ) : (
        sms.map((m) => <MessageBubble key={m.id} m={m} kind="sms" />)
      )}

      <Text style={styles.sectionTitle}>Email</Text>
      <Text style={styles.sectionHint}>Recent thread (oldest at top)</Text>
      {email.length === 0 ? (
        <View style={styles.sectionEmpty}>
          <EmptyState title="No email messages" />
        </View>
      ) : (
        email.map((m) => <MessageBubble key={m.id} m={m} kind="email" />)
      )}
      </ScrollView>
      {!isDemoLeadId(lead.id) ? (
        <LeadReplySection leadId={lead.id} sms={sms} email={email} setSms={setSms} setEmail={setEmail} />
      ) : null}
      {!isDemoLeadId(lead.id) ? (
        <TaskComposerModal
          visible={taskModalOpen}
          leadId={lead.id}
          onClose={() => setTaskModalOpen(false)}
          onCreated={() => {
            void silentRefresh();
          }}
        />
      ) : null}
      {!isDemoLeadId(lead.id) ? (
        <AppointmentComposerModal
          visible={appointmentModalOpen}
          leadIdFixed={lead.id}
          onClose={() => setAppointmentModalOpen(false)}
          onCreated={() => {
            void silentRefresh();
          }}
        />
      ) : null}
      {!isDemoLeadId(lead.id) ? (
        <BookingLinkComposerModal
          visible={bookingLinkModalOpen}
          leadId={lead.id}
          onClose={() => setBookingLinkModalOpen(false)}
          onCreated={() => {
            void silentRefresh();
          }}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: theme.bg },
  scroll: { flex: 1, backgroundColor: theme.bg },
  scrollContent: { paddingBottom: 24 },
  centered: {
    flex: 1,
    backgroundColor: theme.bg,
    padding: 16,
    justifyContent: "flex-start",
    paddingTop: 24,
  },
  card: {
    margin: 12,
    padding: 16,
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  demoBanner: {
    backgroundColor: "#e0f2fe",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#7dd3fc",
  },
  demoBannerText: { fontSize: 13, color: "#0369a1", lineHeight: 18 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  title: { flex: 1, fontSize: 20, fontWeight: "700", color: theme.text },
  hotPill: {
    backgroundColor: theme.hotPillBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.hotBorder,
  },
  hotText: { fontSize: 11, fontWeight: "800", color: theme.hotPillText },
  lastActive: { marginTop: 6, fontSize: 12, color: theme.textMuted },
  line: { marginTop: 8, fontSize: 15, color: "#334155" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12 },
  badge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  muted: { fontSize: 12, color: theme.textSubtle },
  aiLine: { marginTop: 12, fontSize: 13, color: theme.accent, fontWeight: "500" },
  inlineError: {
    fontSize: 13,
    color: theme.errorTitle,
    marginBottom: 8,
    marginTop: 4,
  },
  taskBlock: { marginTop: 4 },
  addTaskBtn: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  addTaskBtnPressed: { opacity: 0.88 },
  addTaskBtnText: { fontSize: 14, fontWeight: "700", color: theme.accent },
  bookingBlock: { marginTop: 8 },
  bookingLinksLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.textMuted,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  scheduleRow: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
  scheduleBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  scheduleBtnText: { fontSize: 14, fontWeight: "700", color: theme.accent },
  scheduleBtnGreen: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#86efac",
  },
  scheduleBtnGreenText: { fontSize: 14, fontWeight: "700", color: "#15803d" },
  cardSectionTitle: {
    marginTop: 18,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: "700",
    color: theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionTitle: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: "700",
    color: theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionHint: {
    marginHorizontal: 16,
    marginBottom: 8,
    fontSize: 12,
    color: theme.textSubtle,
  },
  sectionEmpty: { marginHorizontal: 8 },
  bubbleWrap: {
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 12,
    borderRadius: 12,
    maxWidth: "92%",
  },
  bubbleInbound: {
    alignSelf: "flex-start",
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  bubbleOutbound: {
    alignSelf: "flex-end",
    backgroundColor: "#dbeafe",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  bubbleSubject: { fontSize: 13, fontWeight: "700", color: theme.text, marginBottom: 6 },
  bubbleBody: { fontSize: 15, color: "#1e293b", lineHeight: 22 },
  bubbleMeta: { marginTop: 8, fontSize: 11, color: theme.textMuted },
});
